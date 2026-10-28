import { describe, expect, it } from "vitest";

import { applyRelief, describe as summary, evaluate } from "../../src/progress/bars";
import { parseBar } from "../../src/progress/parse";

// 27 Sep 2026 is a Sunday.
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const SAT = at(26, 12);
const SUN = at(27, 12);
const MON = at(28, 12);

function bar(src: string) {
	const p = parseBar(src, 5);
	if (!p.ok) throw new Error(p.error);
	return p.spec;
}

const daily = bar("Questions answered: 100\nsource: mcq-solved\nevery: 1 day");

describe("Sunday relief", () => {
	it("lowers the goal on Sunday only", () => {
		expect(new Date(SUN).getDay()).toBe(0);
		expect(applyRelief(daily, SAT, 50).bar.total).toBe(100);
		expect(applyRelief(daily, SUN, 50).bar.total).toBe(50);
		expect(applyRelief(daily, MON, 50).bar.total).toBe(100);
		expect(applyRelief(daily, SUN, 50).relief).toEqual({ pct: 50, from: 100 });
	});

	it("does nothing when switched off", () => {
		expect(applyRelief(daily, SUN, null).relief).toBeUndefined();
		expect(applyRelief(daily, SUN, 0).relief).toBeUndefined();
	});

	it("rounds a whole-number goal up", () => {
		const sixty = bar("Time: 60\nsource: mcq-time\nevery: 1 day");
		const seven = bar("X: 0/7\nevery: 1 day");
		expect(applyRelief(sixty, SUN, 25).bar.total).toBe(45);
		expect(applyRelief(seven, SUN, 50).bar.total).toBe(4);
	});

	it("makes 100% a rest day", () => {
		const b = applyRelief(daily, SUN, 100).bar;
		expect(b.total).toBe(0);
		const ev = evaluate(b, SUN, 0);
		expect(ev.percent).toBe(100);
		expect(ev.status).toBe("none");
		expect(summary(b, ev)).toMatch(/^Rest day/);
	});

	it("follows a custom day start", () => {
		const five = bar("Q: 100\nsource: mcq-solved\nevery: 1 day\nstart: 2026:09:01:05:00");
		// Sunday 03:00 still belongs to Saturday's 05:00–05:00 day.
		expect(applyRelief(five, at(27, 3), 50).bar.total).toBe(100);
		expect(applyRelief(five, at(27, 6), 50).bar.total).toBe(50);
		// Monday 03:00 is still Sunday's day.
		expect(applyRelief(five, at(28, 3), 50).bar.total).toBe(50);
	});

	it("leaves weekly and fixed bars alone", () => {
		const weekly = bar("W: 0/500\nevery: 1 week");
		const fixed = bar("F: 0/100\nstart: 2026:09:01\ndeadline: 2026:12:31");
		expect(applyRelief(weekly, SUN, 50).bar.total).toBe(500);
		expect(applyRelief(fixed, SUN, 50).bar.total).toBe(100);
	});

	it("lets a bar's own sunday: line override the setting", () => {
		const own = bar("Q: 100\nsource: mcq-solved\nevery: 1 day\nsunday: 30%");
		const none = bar("Q: 100\nsource: mcq-solved\nevery: 1 day\nsunday: 0");
		expect(applyRelief(own, SUN, null).bar.total).toBe(70);
		expect(applyRelief(own, SUN, 50).bar.total).toBe(70);
		expect(applyRelief(none, SUN, 50).bar.total).toBe(100);
	});
});

describe("parsing sunday:", () => {
	it("accepts a percentage with or without %", () => {
		expect(bar("Q: 100\nsource: mcq-solved\nevery: 1 day\nsunday: 30%").sunday).toBe(30);
		expect(bar("Q: 100\nsource: mcq-solved\nevery: 1 day\nsunday: 30").sunday).toBe(30);
	});

	it("rejects out-of-range values and non-daily bars", () => {
		expect(parseBar("Q: 100\nsource: mcq-solved\nevery: 1 day\nsunday: 120", 5).ok).toBe(false);
		expect(parseBar("W: 0/500\nevery: 1 week\nsunday: 50", 5).ok).toBe(false);
		expect(parseBar("F: 0/100\nsunday: 50", 5).ok).toBe(false);
	});
});
