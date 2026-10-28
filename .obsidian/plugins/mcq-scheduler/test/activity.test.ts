import { describe, expect, it } from "vitest";

import { activityTemplate, minutes, pad4 } from "../src/activity";
import { parseBar, parseHeatmap } from "../src/progress/parse";

describe("pad4", () => {
	it("zero-pads to four digits", () => {
		expect([0, 93, 134, 9999].map(pad4)).toEqual(["0000", "0093", "0134", "9999"]);
	});

	it("grows past four digits rather than truncating", () => {
		expect(pad4(12345)).toBe("12345");
	});
});

describe("minutes", () => {
	it("floors to whole minutes", () => {
		expect(minutes(59_999)).toBe(0);
		expect(minutes(134 * 60_000 + 59_000)).toBe(134);
	});
});

describe("the MCQ activity note template", () => {
	const text = activityTemplate(2981);
	const blocks = [...text.matchAll(/^```(progress|progress-heatmap)\n([\s\S]*?)^```$/gm)];
	const bars = blocks.filter((b) => b[1] === "progress").map((b) => parseBar(b[2], 5, 4));
	const maps = blocks.filter((b) => b[1] === "progress-heatmap").map((b) => parseHeatmap(b[2]));

	it("has bars and heat maps", () => {
		expect(bars.length).toBe(6);
		expect(maps.length).toBe(3);
	});

	it("parses every block without an error", () => {
		expect(bars.filter((b) => !b.ok)).toEqual([]);
		expect(maps.filter((m) => !m.ok)).toEqual([]);
	});

	it("gives every bar a distinct id, and the heat maps name only those ids", () => {
		const ids = bars.map((b) => (b.ok ? b.spec.id : ""));
		expect(new Set(ids).size).toBe(ids.length);
		for (const m of maps) {
			if (!m.ok) continue;
			for (const id of m.spec.bars ?? []) expect(ids).toContain(id);
		}
	});

	it("feeds today's bars from the scheduler, one per day", () => {
		const daily = bars.flatMap((b) => (b.ok && b.spec.type === "recurring" ? [b.spec] : []));
		expect(daily.map((b) => [b.id, b.source, b.total])).toEqual([
			["daily-questions", "mcq-solved", 100],
			["daily-time", "mcq-time", 60],
		]);
	});

	it("schedules modules completed against editable dates", () => {
		const m = bars.find((b) => b.ok && b.spec.id === "modules-completed");
		expect(m?.ok && m.spec.total).toBe(2981);
		expect(m?.ok && m.spec.start !== undefined && m.spec.deadline !== undefined).toBe(true);
	});

	it("contains no callout", () => {
		expect(text).not.toMatch(/^>\s*\[!/m);
	});
});
