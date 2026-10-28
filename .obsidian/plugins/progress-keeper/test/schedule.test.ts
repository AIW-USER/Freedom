import { describe, expect, it } from "vitest";

import type { BarSpec } from "../src/parse";
import { emptyHistory, record } from "../src/history";
import { currentPeriod, describe as summary, evaluate, formatPadded, recurringProgress } from "../src/schedule";

const start = new Date(2026, 0, 1).getTime();
const deadline = new Date(2026, 0, 11).getTime(); // 10 days
const mid = start + (deadline - start) / 2; // expected 50/100

const bar = (value: number, window = 5): BarSpec => ({ id: "a", title: "a", value, total: 100, type: "fixed", start, deadline, window, digits: 4 });

describe("evaluate", () => {
	it("has no status without a schedule", () => {
		expect(evaluate({ id: "a", title: "a", value: 3, total: 10, type: "fixed", window: 5, digits: 4 }, mid)).toEqual({ status: "none", value: 3, percent: 30 });
	});
	it("is on track at the window edges and just inside", () => {
		expect(evaluate(bar(55), mid).status).toBe("on-track");
		expect(evaluate(bar(45), mid).status).toBe("on-track");
		expect(evaluate(bar(50), mid).status).toBe("on-track");
	});
	it("is ahead or behind just past the edges", () => {
		expect(evaluate(bar(55.1), mid).status).toBe("ahead");
		expect(evaluate(bar(44.9), mid).status).toBe("behind");
	});
	it("respects a per-bar window", () => {
		expect(evaluate(bar(58, 10), mid).status).toBe("on-track");
		expect(evaluate(bar(52, 1), mid).status).toBe("ahead");
	});
	it("expects nothing before the start and everything after the deadline", () => {
		expect(evaluate(bar(0), start - 1000).expected).toBe(0);
		expect(evaluate(bar(100), deadline + 1000).status).toBe("on-track");
		expect(evaluate(bar(80), deadline + 1000).status).toBe("behind");
	});
	it("works out the daily rate still needed", () => {
		expect(evaluate(bar(50), mid).perDayNeeded).toBeCloseTo(10);
	});
});

describe("describe", () => {
	it("summarises the schedule", () => {
		expect(summary(bar(60), evaluate(bar(60), mid))).toBe("+10.0% ahead · 5d left · need 8/day");
		expect(summary(bar(100), evaluate(bar(100), mid))).toBe("Complete");
		expect(summary(bar(10), evaluate(bar(10), deadline + 1))).toBe("−90.0% behind · deadline passed");
	});
});

describe("recurring", () => {
	const rec = (every: BarSpec["every"], anchor?: number): BarSpec => ({ id: "r", title: "r", value: 0, total: 100, type: "recurring", every, count: "reset", start: anchor, window: 5, digits: 4 });
	const now = new Date(2026, 8, 24, 18, 0).getTime(); // Thu 24 Sep 18:00

	it("finds the current period for each unit", () => {
		expect(currentPeriod(rec({ n: 1, unit: "day" }), now)).toEqual({ start: new Date(2026, 8, 24).getTime(), end: new Date(2026, 8, 25).getTime() });
		expect(currentPeriod(rec({ n: 1, unit: "week" }), now)).toEqual({ start: new Date(2026, 8, 21).getTime(), end: new Date(2026, 8, 28).getTime() });
		expect(currentPeriod(rec({ n: 1, unit: "month" }), now)).toEqual({ start: new Date(2026, 8, 1).getTime(), end: new Date(2026, 9, 1).getTime() });
		expect(currentPeriod(rec({ n: 6, unit: "hour" }), now)).toEqual({ start: new Date(2026, 8, 24, 18).getTime(), end: new Date(2026, 8, 25, 0).getTime() });
	});
	it("counts multi-unit periods from the anchor", () => {
		const anchor = new Date(2026, 8, 1, 5).getTime(); // Tue 1 Sep 05:00
		expect(currentPeriod(rec({ n: 3, unit: "day" }, anchor), now)).toEqual({ start: new Date(2026, 8, 22, 5).getTime(), end: new Date(2026, 8, 25, 5).getTime() });
		expect(currentPeriod(rec({ n: 1, unit: "day" }, anchor), new Date(2026, 8, 24, 4).getTime()).start).toBe(new Date(2026, 8, 23, 5).getTime());
	});
	it("keeps fortnights stable without an anchor", () => {
		const a = currentPeriod(rec({ n: 2, unit: "week" }), now);
		expect(a.end - a.start).toBe(14 * 86_400_000);
		expect(currentPeriod(rec({ n: 2, unit: "week" }), a.start + 1000)).toEqual(a);
	});
	it("judges progress against the elapsed part of the period", () => {
		// 18:00 is 75% through the day.
		const b = rec({ n: 1, unit: "day" });
		expect(evaluate(b, now, 75).status).toBe("on-track");
		expect(evaluate(b, now, 50).status).toBe("behind");
		expect(evaluate(b, now, 90).status).toBe("ahead");
		expect(summary(b, evaluate(b, now, 50))).toBe("−25.0% behind · 50 to go · resets in 6h");
		expect(summary(b, evaluate(b, now, 100))).toBe("Done this period · resets in 6h");
	});
});

describe("recurringProgress", () => {
	const yesterday = new Date(2026, 8, 24, 22, 46).getTime();
	const today = new Date(2026, 8, 25, 9, 0).getTime();
	const later = new Date(2026, 8, 25, 22, 0).getTime();
	const q = (value: number, count: "reset" | "running" = "reset"): BarSpec => ({
		id: "q", title: "q", value, total: 100, type: "recurring", every: { n: 1, unit: "day" }, count, window: 5, digits: 4,
	});

	it("reset: shows the note's number as soon as it is typed, before the save is logged", () => {
		const h = emptyHistory();
		record(h, "q", 0, yesterday);
		expect(recurringProgress(q(50), h, today).done).toBe(50);
	});
	it("reset: shows the number when it was set this period", () => {
		const h = emptyHistory();
		record(h, "q", 0, yesterday);
		record(h, "q", 50, today);
		expect(recurringProgress(q(50), h, later).done).toBe(50);
	});
	it("reset: a number left from an earlier period reads 0, with a hint", () => {
		const h = emptyHistory();
		record(h, "q", 0, yesterday - 1000);
		record(h, "q", 50, yesterday);
		const r = recurringProgress(q(50), h, today);
		expect(r.done).toBe(0);
		expect(r.hint).toMatch(/still says 50/);
	});
	it("reset: works with history saved before lastT existed", () => {
		const h = { last: { q: 50 }, events: [{ id: "q", t: today, d: 50 }] };
		expect(recurringProgress(q(50), h, later).done).toBe(50);
		expect(recurringProgress(q(50), { last: { q: 50 }, events: [{ id: "q", t: yesterday, d: 50 }] }, today).done).toBe(0);
	});
	it("reset: a bar seen for the first time shows its number", () => {
		expect(recurringProgress(q(30), emptyHistory(), today).done).toBe(30);
	});
	it("running: shows what was added this period, including an unsaved edit", () => {
		const h = emptyHistory();
		record(h, "q", 0, yesterday - 1000);
		record(h, "q", 50, yesterday);
		expect(recurringProgress(q(50, "running"), h, today).done).toBe(0);
		record(h, "q", 70, today);
		expect(recurringProgress(q(70, "running"), h, later).done).toBe(20);
		expect(recurringProgress(q(85, "running"), h, later).done).toBe(35);
	});
});

describe("formatPadded", () => {
	it("pads the whole-number part", () => {
		expect(formatPadded(50, 4)).toBe("0050");
		expect(formatPadded(2981, 4)).toBe("2981");
		expect(formatPadded(12345, 4)).toBe("12345");
		expect(formatPadded(12.5, 4)).toBe("0012.5");
		expect(formatPadded(0, 4)).toBe("0000");
		expect(formatPadded(7, 0)).toBe("7");
	});
});
