import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sourceProgress } from "../../src/progress/bars";
import { addEvent, clearEvents, emptyHistory, totalSince } from "../../src/progress/history";
import { extractBars, parseBar, sourceKey } from "../../src/progress/parse";

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();

describe("source: bars", () => {
	it("accept `Title: total` as the first line", () => {
		const p = parseBar("Questions answered: 100\nsource: mcq-solved\nevery: 1 day", 5);
		expect(p.ok && [p.spec.source, p.spec.total, p.spec.value, p.spec.type]).toEqual([
			"mcq-solved",
			100,
			0,
			"recurring",
		]);
	});

	it("ignore a typed value", () => {
		const p = parseBar("Modules completed: 0050/2981\nsource: modules-completed", 5);
		expect(p.ok && [p.spec.value, p.spec.total]).toEqual([0, 2981]);
	});

	it("still require value/total on a bar without a source", () => {
		expect(parseBar("Progress: 100", 5).ok).toBe(false);
	});

	it("reject an unknown source", () => {
		const p = parseBar("X: 10\nsource: pages-read", 5);
		expect(!p.ok && p.error).toMatch(/Source must be one of/);
	});
});

describe("source progress", () => {
	const h = emptyHistory();
	const key = sourceKey("mcq-solved");
	addEvent(h, key, 5, at(24, 10)); // yesterday
	addEvent(h, key, 3, at(25, 9)); // today
	addEvent(h, key, 4, at(25, 14)); // today

	it("counts only the current period on a recurring bar", () => {
		const p = parseBar("Questions: 100\nsource: mcq-solved\nevery: 1 day", 5);
		expect(p.ok && sourceProgress(p.spec, h, at(25, 18))).toBe(7);
	});

	it("counts everything since start on a fixed bar", () => {
		const all = parseBar("Solved: 12528\nsource: mcq-solved", 5);
		expect(all.ok && sourceProgress(all.spec, h, at(25, 18))).toBe(12);
		const since = parseBar("Solved: 1000\nsource: mcq-solved\nstart: 2026:09:25\ndeadline: 2026:12:31", 5);
		expect(since.ok && sourceProgress(since.spec, h, at(25, 18))).toBe(7);
	});

	it("goes down when a completed module is reset", () => {
		const m = emptyHistory();
		const k = sourceKey("modules-completed");
		addEvent(m, k, 1, at(25, 9));
		addEvent(m, k, 1, at(25, 11));
		addEvent(m, k, -1, at(25, 12));
		expect(totalSince(m.events, k)).toBe(1);
	});
});

describe("addEvent", () => {
	it("merges deltas for one source within the same hour", () => {
		const h = emptyHistory();
		addEvent(h, "src:mcq-time", 0.5, at(25, 9, 5));
		addEvent(h, "src:mcq-solved", 1, at(25, 9, 6));
		addEvent(h, "src:mcq-time", 1.25, at(25, 9, 50));
		expect(h.events.length).toBe(2);
		expect(h.events.find((e) => e.id === "src:mcq-time")?.d).toBe(1.75);
	});

	it("starts a new event in the next hour", () => {
		const h = emptyHistory();
		addEvent(h, "src:mcq-solved", 1, at(25, 9, 59));
		addEvent(h, "src:mcq-solved", 1, at(25, 10, 0));
		expect(h.events.length).toBe(2);
	});

	it("ignores a zero delta, and clearEvents drops one source only", () => {
		const h = emptyHistory();
		addEvent(h, "src:mcq-solved", 0, at(25, 9));
		expect(h.events).toEqual([]);
		addEvent(h, "src:mcq-solved", 1, at(25, 9));
		addEvent(h, "src:mcq-time", 2, at(25, 9));
		clearEvents(h, "src:mcq-solved");
		expect(h.events.map((e) => e.id)).toEqual(["src:mcq-time"]);
	});
});

describe("extractBars", () => {
	it("skips example blocks shown inside a four-backtick fence", () => {
		const text = [
			"````",
			"```progress",
			"Example: 1/10",
			"```",
			"````",
			"",
			"```progress",
			"Real: 2/10",
			"```",
		].join("\n");
		expect(extractBars(text, 5).map((b) => b.title)).toEqual(["Real"]);
	});

	it("finds no bars in the README's Progress bars help", () => {
		const text = readFileSync("/Users/phaneendra/Freedom/README.md", "utf8");
		expect(extractBars(text, 5)).toEqual([]);
	});
});
