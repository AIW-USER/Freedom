import { describe, expect, it } from "vitest";

import { extractBars, parseBar, parseDate, parseEvery, parseHeatmap } from "../src/parse";

describe("parseDate", () => {
	it("reads yyyy:mm:dd:hh:mm as local time", () => {
		expect(parseDate("2026:12:31:23:59")).toBe(new Date(2026, 11, 31, 23, 59).getTime());
	});
	it("defaults the time to midnight", () => {
		expect(parseDate("2026:09:01")).toBe(new Date(2026, 8, 1).getTime());
	});
	it("accepts dashes and a space", () => {
		expect(parseDate("2026-09-01 08:30")).toBe(new Date(2026, 8, 1, 8, 30).getTime());
	});
	it("rejects impossible dates", () => {
		expect(parseDate("2026:13:01")).toBeNull();
		expect(parseDate("2026:09:31")).toBeNull();
		expect(parseDate("2026:09:01:24:00")).toBeNull();
		expect(parseDate("tomorrow")).toBeNull();
	});
});

describe("parseBar", () => {
	it("parses the APB-style head line, splitting on the last colon", () => {
		const r = parseBar("Time spent (mins): 12.5/60", 5);
		expect(r).toEqual({ ok: true, spec: { id: "Time spent (mins)", title: "Time spent (mins)", value: 12.5, total: 60, type: "fixed", window: 5, digits: 4 } });
	});
	it("reads schedule, window and id", () => {
		const r = parseBar("Mastered: 120/2981\nstart: 2026:09:01:00:00\ndeadline: 2026:12:31:23:59\nwindow: 3%\nid: mastered", 5);
		expect(r.ok && r.spec).toMatchObject({ id: "mastered", title: "Mastered", window: 3, start: new Date(2026, 8, 1).getTime() });
	});
	it("reads leading zeros and a digits override", () => {
		expect(parseBar("A: 0050/0100", 5)).toMatchObject({ ok: true, spec: { value: 50, total: 100, digits: 4 } });
		expect(parseBar("A: 5/10\ndigits: 2", 5)).toMatchObject({ ok: true, spec: { digits: 2 } });
		expect(parseBar("A: 5/10", 5, 0)).toMatchObject({ ok: true, spec: { digits: 0 } });
		expect(parseBar("A: 5/10\ndigits: -1", 5).ok).toBe(false);
	});
	it("requires both start and deadline", () => {
		expect(parseBar("A: 1/2\nstart: 2026:09:01", 5).ok).toBe(false);
	});
	it("rejects a deadline before the start", () => {
		expect(parseBar("A: 1/2\nstart: 2026:09:02\ndeadline: 2026:09:01", 5).ok).toBe(false);
	});
	it("rejects a bad head or a zero total", () => {
		expect(parseBar("Mastered 1 of 2", 5).ok).toBe(false);
		expect(parseBar("A: 1/0", 5).ok).toBe(false);
	});
});

describe("recurring bars", () => {
	it("reads type and every", () => {
		const r = parseBar("Questions: 30/100\ntype: recurring\nevery: 2 weeks", 5);
		expect(r.ok && r.spec).toMatchObject({ type: "recurring", every: { n: 2, unit: "week" } });
	});
	it("defaults to every day, and every: alone implies recurring", () => {
		expect(parseBar("Q: 1/10\ntype: recurring", 5)).toMatchObject({ ok: true, spec: { every: { n: 1, unit: "day" } } });
		expect(parseBar("Q: 1/10\nevery: weekly", 5)).toMatchObject({ ok: true, spec: { type: "recurring", every: { n: 1, unit: "week" } } });
	});
	it("takes start as the period anchor", () => {
		const r = parseBar("Q: 1/10\ntype: recurring\nstart: 2026:09:01:05:00", 5);
		expect(r.ok && r.spec.start).toBe(new Date(2026, 8, 1, 5).getTime());
	});
	it("reads count, defaulting to reset", () => {
		expect(parseBar("Q: 1/10\ntype: recurring", 5)).toMatchObject({ ok: true, spec: { count: "reset" } });
		expect(parseBar("Q: 1/10\nevery: 1 day\ncount: running", 5)).toMatchObject({ ok: true, spec: { count: "running" } });
		expect(parseBar("Q: 1/10\nevery: 1 day\ncount: sometimes", 5).ok).toBe(false);
		expect(parseBar("Q: 1/10\ncount: running", 5).ok).toBe(false);
	});
	it("rejects a deadline on a recurring bar and every on a fixed one", () => {
		expect(parseBar("Q: 1/10\ntype: recurring\ndeadline: 2026:10:01", 5).ok).toBe(false);
		expect(parseBar("Q: 1/10\ntype: fixed\nevery: 1 day", 5).ok).toBe(false);
		expect(parseBar("Q: 1/10\ntype: sometimes", 5).ok).toBe(false);
	});
	it("parses every in many spellings", () => {
		expect(parseEvery("1 day")).toEqual({ n: 1, unit: "day" });
		expect(parseEvery("12h")).toEqual({ n: 12, unit: "hour" });
		expect(parseEvery("every 3 days")).toEqual({ n: 3, unit: "day" });
		expect(parseEvery("monthly")).toEqual({ n: 1, unit: "month" });
		expect(parseEvery("fortnightly")).toEqual({ n: 2, unit: "week" });
		expect(parseEvery("0 days")).toBeNull();
		expect(parseEvery("2 years")).toBeNull();
	});
});

describe("parseHeatmap", () => {
	it("has defaults", () => {
		expect(parseHeatmap("")).toEqual({ ok: true, spec: { bars: null, unit: "day", cells: 90, measure: "value" } });
	});
	it("reads every key", () => {
		const r = parseHeatmap("title: T\nbars: a, b\nunit: weeks\ncells: 26\nmeasure: percent");
		expect(r).toEqual({ ok: true, spec: { title: "T", bars: ["a", "b"], unit: "week", cells: 26, measure: "percent" } });
	});
	it("rejects unknown units and bad cell counts", () => {
		expect(parseHeatmap("unit: year").ok).toBe(false);
		expect(parseHeatmap("cells: 0").ok).toBe(false);
		expect(parseHeatmap("cells: 2.5").ok).toBe(false);
	});
});

describe("extractBars", () => {
	it("finds progress blocks but not heat maps or other code", () => {
		const text = [
			"# Note",
			"```progress",
			"A: 1/10",
			"```",
			"```progress-heatmap",
			"bars: all",
			"```",
			"~~~progress",
			"B: 2/10",
			"~~~",
			"```js",
			"x: 1/2",
			"```",
		].join("\n");
		expect(extractBars(text, 5).map((b) => b.id)).toEqual(["A", "B"]);
	});
});
