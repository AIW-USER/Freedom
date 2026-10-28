import { bucketStart, HistoryState, lastChange, periodSum, shift } from "./history";
import type { BarSpec, Every } from "./parse";

/**
 * Where a bar stands against a straight line from 0 at the start to `total`
 * at the end. For a fixed bar that line runs from `start` to `deadline`; for
 * a recurring bar it runs across the current period. `delta` is in
 * percentage points of the total: within ±window is on track (blue), above it
 * ahead (green), below it behind (red).
 */
export type Status = "ahead" | "behind" | "on-track" | "none";

export interface Period {
	start: number;
	end: number;
}

export interface Evaluation {
	status: Status;
	/** The value shown: the note's number for fixed bars, this period's progress for recurring ones. */
	value: number;
	percent: number;
	/** Recurring bars only. */
	period?: Period;
	/** Only when the bar has a schedule. */
	expected?: number;
	expectedPercent?: number;
	delta?: number;
	msLeft?: number;
	/** Fixed bars: units per day still needed to finish on time. */
	perDayNeeded?: number;
	/** A note for the reader, e.g. why a recurring bar reads 0. */
	hint?: string;
}

const DAY = 86_400_000;
const APPROX: Record<Every["unit"], number> = { hour: 3_600_000, day: DAY, week: 7 * DAY, month: 30.44 * DAY };
/** Default anchor for periods longer than one unit: Monday 5 Jan 2026, so "every 2 weeks" is stable. */
const EPOCH = new Date(2026, 0, 5).getTime();

/**
 * The period of a recurring bar holding `now`. Periods are `every.n` calendar
 * units long, counted from `start` (or from midnight / Monday / the 1st),
 * so DST days and short months are handled by the calendar, not by ms maths.
 */
export function currentPeriod(bar: BarSpec, now: number): Period {
	const every = bar.every ?? { n: 1, unit: "day" };
	const anchor = bar.start ?? bucketStart(every.n === 1 ? now : EPOCH, every.unit);
	const at = (k: number) => shift(anchor, every.unit, k * every.n);
	let k = Math.floor((now - anchor) / (APPROX[every.unit] * every.n));
	while (at(k) > now) k--;
	while (at(k + 1) <= now) k++;
	return { start: at(k), end: at(k + 1) };
}

/**
 * What a recurring bar has done this period. Reads the note's number as it
 * is now, not only what has been logged: a block redraws the moment you leave
 * it, before Obsidian saves the note and the change reaches the log.
 *
 * - `reset` (default): the number is this period's count, if it was set this
 *   period. A number left over from an earlier period counts as 0.
 * - `running`: the number is a tally; progress is how much it rose this period.
 */
export function recurringProgress(bar: BarSpec, history: HistoryState, now: number): { done: number; hint?: string } {
	const period = currentPeriod(bar, now);
	const known = bar.id in history.last;
	const unsaved = known && history.last[bar.id] !== bar.value;

	if (bar.count === "running") {
		const logged = periodSum(history.events, bar.id, period.start, period.end);
		const pending = unsaved ? bar.value - history.last[bar.id] : 0;
		return { done: Math.max(0, logged + pending) };
	}

	const changed = lastChange(history, bar.id);
	const fresh = !known || unsaved || (changed !== undefined && changed >= period.start);
	if (fresh) return { done: bar.value };
	return {
		done: 0,
		hint: bar.value === 0 ? undefined : `The note still says ${formatNumber(bar.value)} from the last period. Type this period's count to update it.`,
	};
}

/**
 * `done` is the progress to show: pass this period's sum for a recurring bar.
 * It defaults to the note's value, which is right for fixed bars.
 */
export function evaluate(bar: BarSpec, now: number, done: number = bar.value): Evaluation {
	const percent = (done / bar.total) * 100;
	let from: number;
	let to: number;
	let period: Period | undefined;
	if (bar.type === "recurring") {
		period = currentPeriod(bar, now);
		from = period.start;
		to = period.end;
	} else if (bar.start !== undefined && bar.deadline !== undefined) {
		from = bar.start;
		to = bar.deadline;
	} else {
		return { status: "none", value: done, percent };
	}

	const fraction = Math.min(1, Math.max(0, (now - from) / (to - from)));
	const expected = bar.total * fraction;
	const delta = ((done - expected) / bar.total) * 100;
	// Compare with a hair of slack so 5.0000000001 still counts as inside a 5 window.
	const eps = 1e-9;
	const status: Status = delta > bar.window + eps ? "ahead" : delta < -bar.window - eps ? "behind" : "on-track";
	const msLeft = to - now;
	const remaining = Math.max(0, bar.total - done);
	const perDayNeeded = bar.type === "fixed" && msLeft > 0 ? remaining / (msLeft / DAY) : undefined;
	return { status, value: done, percent, period, expected, expectedPercent: fraction * 100, delta, msLeft, perDayNeeded };
}

export function formatDuration(ms: number): string {
	const mins = Math.floor(ms / 60_000);
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 48) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

export function formatNumber(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

/** `50` with 4 digits → `0050`. Only the whole-number part is padded: `12.5` → `0012.5`. */
export function formatPadded(n: number, digits: number): string {
	const text = formatNumber(Math.abs(n));
	const [whole, frac] = text.split(".");
	const padded = whole.padStart(digits, "0") + (frac === undefined ? "" : `.${frac}`);
	return n < 0 ? `-${padded}` : padded;
}

/** `1 day` → "Every day", `2 weeks` → "Every 2 weeks". */
export function formatEvery(every: Every): string {
	return every.n === 1 ? `Every ${every.unit}` : `Every ${every.n} ${every.unit}s`;
}

/** One-line schedule summary, e.g. `+8.2% ahead · 34d left`. Empty with no schedule. */
export function describe(bar: BarSpec, ev: Evaluation): string {
	if (ev.status === "none" || ev.delta === undefined || ev.msLeft === undefined) return "";

	if (bar.type === "recurring") {
		const resets = `resets in ${formatDuration(ev.msLeft)}`;
		if (ev.value >= bar.total) return `Done this period · ${resets}`;
		const sign = ev.delta >= 0 ? "+" : "−";
		const word = ev.status === "on-track" ? "on track" : ev.status;
		return `${sign}${Math.abs(ev.delta).toFixed(1)}% ${word} · ${formatNumber(+(bar.total - ev.value).toFixed(2))} to go · ${resets}`;
	}

	if (ev.value >= bar.total) return "Complete";
	const sign = ev.delta >= 0 ? "+" : "−";
	const word = ev.status === "on-track" ? "on track" : ev.status;
	const parts = [`${sign}${Math.abs(ev.delta).toFixed(1)}% ${word}`];
	if (ev.msLeft <= 0) parts.push("deadline passed");
	else {
		parts.push(`${formatDuration(ev.msLeft)} left`);
		if (ev.perDayNeeded !== undefined) parts.push(`need ${formatNumber(+ev.perDayNeeded.toFixed(2))}/day`);
	}
	return parts.join(" · ");
}
