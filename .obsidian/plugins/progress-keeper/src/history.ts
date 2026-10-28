import type { Unit } from "./parse";

/**
 * Every change to a bar's value is logged as a signed delta with a timestamp.
 * Keeping raw timestamps (rather than daily totals) is what lets one heat map
 * bucket by hour and another by month from the same log. Typing "120" over
 * "0" may save as 1, 12, 120 — the deltas still sum to +120.
 */
export interface HistoryEvent {
	id: string;
	t: number;
	d: number;
}

export interface HistoryState {
	last: Record<string, number>;
	/** When each bar's number last changed. Missing in data saved before it existed. */
	lastT?: Record<string, number>;
	events: HistoryEvent[];
}

export function emptyHistory(): HistoryState {
	return { last: {}, lastT: {}, events: [] };
}

/** When a bar's number last changed: `lastT`, else its newest logged event. */
export function lastChange(state: HistoryState, id: string): number | undefined {
	const t = state.lastT?.[id];
	if (t !== undefined) return t;
	for (let i = state.events.length - 1; i >= 0; i--) if (state.events[i].id === id) return state.events[i].t;
	return undefined;
}

/**
 * Note a bar's current value. The first sighting only sets a baseline, so a
 * bar that already reads 500/1000 doesn't show up as 500 done today.
 *
 * `baseline` overrides the previous value when working out the delta. A
 * reset-count recurring bar passes 0 for its first change in a new period:
 * yesterday's 50 → today's 20 is 20 done today, not −30, and 50 → 0 is a
 * reset, not lost work. Returns true when an event was logged.
 */
export function record(state: HistoryState, id: string, value: number, t: number, baseline?: number): boolean {
	state.lastT ??= {};
	if (!(id in state.last)) {
		state.last[id] = value;
		state.lastT[id] = t;
		return false;
	}
	const prev = state.last[id];
	if (prev === value) return false;
	state.last[id] = value;
	state.lastT[id] = t;
	const d = value - (baseline ?? prev);
	if (d === 0) return false;
	state.events.push({ id, t, d });
	return true;
}

/** Net change to one bar in [from, to). Not floored. */
export function periodSum(events: HistoryEvent[], id: string, from: number, to: number): number {
	let sum = 0;
	for (const e of events) if (e.id === id && e.t >= from && e.t < to) sum += e.d;
	return sum;
}

/** Start of the bucket holding `t`, local time. Weeks start on Monday. */
export function bucketStart(t: number, unit: Unit): number {
	const d = new Date(t);
	switch (unit) {
		case "hour":
			d.setMinutes(0, 0, 0);
			break;
		case "day":
			d.setHours(0, 0, 0, 0);
			break;
		case "week":
			d.setHours(0, 0, 0, 0);
			d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
			break;
		case "month":
			d.setHours(0, 0, 0, 0);
			d.setDate(1);
			break;
	}
	return d.getTime();
}

/** Move a bucket start by `n` units (negative goes back). Calendar-aware, so DST and month lengths are right. */
export function shift(start: number, unit: Unit, n: number): number {
	const d = new Date(start);
	switch (unit) {
		case "hour":
			d.setHours(d.getHours() + n);
			break;
		case "day":
			d.setDate(d.getDate() + n);
			break;
		case "week":
			d.setDate(d.getDate() + 7 * n);
			break;
		case "month":
			d.setMonth(d.getMonth() + n);
			break;
	}
	return d.getTime();
}

export interface Bucket {
	start: number;
	amount: number;
}

/**
 * The last `cells` buckets up to and including the one holding `now`, oldest
 * first. `weight(id)` scales each bar's deltas (1 for raw values, 100/total
 * for percent); ids it returns null for are skipped. A bucket's net is
 * floored at 0, since the heat map shows progress made, not corrections.
 */
export function buckets(
	events: HistoryEvent[],
	weight: (id: string) => number | null,
	unit: Unit,
	cells: number,
	now: number,
): Bucket[] {
	const last = bucketStart(now, unit);
	const out: Bucket[] = [];
	for (let i = cells - 1; i >= 0; i--) out.push({ start: shift(last, unit, -i), amount: 0 });
	const end = shift(last, unit, 1);
	const first = out[0].start;

	for (const e of events) {
		if (e.t < first || e.t >= end) continue;
		const w = weight(e.id);
		if (w === null) continue;
		// Binary search for the last bucket starting at or before e.t.
		let lo = 0;
		let hi = out.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (out[mid].start <= e.t) lo = mid;
			else hi = mid - 1;
		}
		out[lo].amount += e.d * w;
	}
	for (const b of out) if (b.amount < 0) b.amount = 0;
	return out;
}

/** 0 for empty, else 1–4 relative to the busiest bucket. */
export function level(amount: number, max: number): number {
	if (amount <= 0 || max <= 0) return 0;
	return Math.max(1, Math.min(4, Math.ceil((amount / max) * 4)));
}
