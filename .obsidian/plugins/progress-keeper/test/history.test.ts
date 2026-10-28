import { describe, expect, it } from "vitest";

import { bucketStart, buckets, emptyHistory, lastChange, level, periodSum, record, shift } from "../src/history";

describe("record", () => {
	it("only sets a baseline the first time a bar is seen", () => {
		const h = emptyHistory();
		expect(record(h, "a", 500, 1)).toBe(false);
		expect(h.events).toEqual([]);
		expect(h.last.a).toBe(500);
	});
	it("logs signed deltas and ignores unchanged values", () => {
		const h = emptyHistory();
		record(h, "a", 0, 1);
		expect(record(h, "a", 12, 2)).toBe(true);
		expect(record(h, "a", 12, 3)).toBe(false);
		expect(record(h, "a", 10, 4)).toBe(true);
		expect(h.events).toEqual([
			{ id: "a", t: 2, d: 12 },
			{ id: "a", t: 4, d: -2 },
		]);
	});
});

describe("recurring baseline", () => {
	it("counts a new period's first change from the given baseline", () => {
		const h = emptyHistory();
		record(h, "a", 0, 1);
		record(h, "a", 50, 2);
		// Next period: typing 20 over yesterday's 50 is +20, and 50 → 0 is a silent reset.
		expect(record(h, "a", 20, 3, 0)).toBe(true);
		expect(record(h, "a", 0, 4, 0)).toBe(false);
		expect(h.events.map((e) => e.d)).toEqual([50, 20]);
		expect(h.last.a).toBe(0);
		expect(h.lastT?.a).toBe(4);
	});
	it("finds the last change from lastT or, in old data, the newest event", () => {
		expect(lastChange({ last: { a: 5 }, events: [{ id: "a", t: 7, d: 5 }, { id: "b", t: 9, d: 1 }] }, "a")).toBe(7);
		expect(lastChange({ last: { a: 5 }, lastT: { a: 11 }, events: [] }, "a")).toBe(11);
		expect(lastChange(emptyHistory(), "a")).toBeUndefined();
	});
	it("sums one bar over a window", () => {
		const events = [
			{ id: "a", t: 5, d: 10 },
			{ id: "b", t: 6, d: 99 },
			{ id: "a", t: 7, d: -3 },
			{ id: "a", t: 20, d: 50 },
		];
		expect(periodSum(events, "a", 5, 20)).toBe(7);
		expect(periodSum([{ id: "a", t: 5, d: -4 }], "a", 0, 10)).toBe(-4);
	});
});

describe("bucketStart / shift", () => {
	const t = new Date(2026, 8, 24, 21, 52).getTime(); // Thursday
	it("buckets by each unit", () => {
		expect(bucketStart(t, "hour")).toBe(new Date(2026, 8, 24, 21).getTime());
		expect(bucketStart(t, "day")).toBe(new Date(2026, 8, 24).getTime());
		expect(bucketStart(t, "week")).toBe(new Date(2026, 8, 21).getTime()); // Monday
		expect(bucketStart(t, "month")).toBe(new Date(2026, 8, 1).getTime());
	});
	it("steps on the calendar", () => {
		expect(shift(new Date(2026, 2, 1).getTime(), "month", -1)).toBe(new Date(2026, 1, 1).getTime());
		expect(shift(new Date(2026, 8, 21).getTime(), "week", -1)).toBe(new Date(2026, 8, 14).getTime());
		expect(shift(new Date(2026, 8, 24, 0).getTime(), "hour", -1)).toBe(new Date(2026, 8, 23, 23).getTime());
	});
});

describe("buckets", () => {
	const now = new Date(2026, 8, 24, 21, 52).getTime();
	const at = (d: number, h = 12) => new Date(2026, 8, d, h).getTime();
	const events = [
		{ id: "a", t: at(24), d: 10 },
		{ id: "a", t: at(24, 13), d: -3 },
		{ id: "b", t: at(23), d: 5 },
		{ id: "a", t: at(20), d: 4 }, // outside a 3-day window
		{ id: "a", t: at(22), d: -8 }, // net negative day floors at 0
	];

	it("sums per day, oldest first, and floors at 0", () => {
		const r = buckets(events, () => 1, "day", 3, now);
		expect(r.map((b) => b.start)).toEqual([at(22, 0), at(23, 0), at(24, 0)]);
		expect(r.map((b) => b.amount)).toEqual([0, 5, 7]);
	});
	it("filters and weights by bar", () => {
		const r = buckets(events, (id) => (id === "b" ? 20 : null), "day", 3, now);
		expect(r.map((b) => b.amount)).toEqual([0, 100, 0]);
	});
	it("buckets by hour, week and month", () => {
		expect(buckets(events, () => 1, "hour", 12, now).slice(-10, -8).map((b) => b.amount)).toEqual([10, 0]);
		expect(buckets(events, () => 1, "week", 2, now).map((b) => b.amount)).toEqual([4, 4]);
		expect(buckets(events, () => 1, "month", 1, now).map((b) => b.amount)).toEqual([8]);
	});
});

describe("level", () => {
	it("scales 1–4 against the max", () => {
		expect([0, 1, 25, 26, 100].map((a) => level(a, 100))).toEqual([0, 1, 1, 2, 4]);
	});
});
