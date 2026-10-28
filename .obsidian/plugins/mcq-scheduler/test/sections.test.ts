import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	H_CORRECT,
	H_EXPLANATION,
	H_ILLUSTRATIONS,
	H_OPTIONS,
	H_QUESTION,
	splitBlocks,
} from "../src/parser";
import { gateForHeading, gateForLine, headingAtLine, headingRefs } from "../src/sections";

const MCQ_DIR = "/Users/phaneendra/Freedom/MCQ";

describe("headingAtLine", () => {
	const note = [
		"# OB1", // 0
		"", // 1
		"#OB #kneesports #acltear", // 2
		"", // 3
		"Topic: [[acl-tear]]", // 4
		"", // 5
		"## Question", // 6
		"", // 7
		"During ACL reconstruction…", // 8
		"", // 9
		"## Correct option", // 10
		"", // 11
		"**2. Femoral tunnel is too anterior**", // 12
		"", // 13
		"## Answer explanation", // 14
		"", // 15
		"### A sub-heading inside the explanation", // 16
		"", // 17
		"The majority of early failures…", // 18
	];
	const hs = headingRefs(note);

	it("finds every level-2 heading and no other", () => {
		expect(hs.map((h) => h.heading)).toEqual([H_QUESTION, H_CORRECT, H_EXPLANATION]);
	});

	it("returns null above the first heading", () => {
		for (const line of [0, 1, 2, 3, 4, 5]) expect(headingAtLine(hs, line)).toBeNull();
	});

	it("returns the heading's own name for the heading line itself", () => {
		// Load-bearing: it is what makes the rendered <h2> hide with its body,
		// so nothing is left behind as an orphan heading.
		expect(headingAtLine(hs, 10)).toBe(H_CORRECT);
	});

	it("returns the preceding heading for a body line", () => {
		expect(headingAtLine(hs, 12)).toBe(H_CORRECT);
		expect(headingAtLine(hs, 13)).toBe(H_CORRECT);
	});

	it("does not let an H3 inside an explanation re-attribute the blocks under it", () => {
		expect(headingAtLine(hs, 16)).toBe(H_EXPLANATION);
		expect(headingAtLine(hs, 18)).toBe(H_EXPLANATION);
	});

	it("carries the last section to the end of the file", () => {
		expect(headingAtLine(hs, note.length + 50)).toBe(H_EXPLANATION);
	});

	it("handles an empty section", () => {
		const empty = headingRefs(["## Options", "## Correct option", "a. x"]);
		expect(headingAtLine(empty, 0)).toBe(H_OPTIONS);
		expect(headingAtLine(empty, 1)).toBe(H_CORRECT);
	});
});

describe("gateForHeading", () => {
	it("gates the options and the answer permanently", () => {
		expect(gateForHeading(H_OPTIONS)).toBe("always");
		expect(gateForHeading(H_CORRECT)).toBe("always");
	});

	it("gates the explanation and illustrations until answered", () => {
		expect(gateForHeading(H_EXPLANATION)).toBe("answer");
		expect(gateForHeading(H_ILLUSTRATIONS)).toBe("answer");
	});

	it("leaves the question, its images, the preamble and anything unknown visible", () => {
		expect(gateForHeading(H_QUESTION)).toBe("visible");
		expect(gateForHeading("Question images")).toBe("visible");
		expect(gateForHeading(null)).toBe("visible");
		expect(gateForHeading("Notes")).toBe("visible");
	});
});

// ---------------------------------------------------------------- the corpus

const files = readdirSync(MCQ_DIR)
	.filter((f) => f.endsWith(".md"))
	.sort();

const corpus = files.map((name) => ({
	name,
	lines: readFileSync(join(MCQ_DIR, name), "utf8").split("\n"),
}));

describe("attribution over the real bank", () => {
	it("has notes to check", () => {
		expect(corpus.length).toBeGreaterThan(12000);
	});

	/**
	 * The test that would actually catch a leak: every line of every gated
	 * block — the heading line included — must resolve to a gate that hides it.
	 */
	it("never lets an answer line fall into a visible gate", () => {
		const leaks: string[] = [];
		const expected: Record<string, "always" | "answer"> = {
			[H_OPTIONS]: "always",
			[H_CORRECT]: "always",
			[H_EXPLANATION]: "answer",
			[H_ILLUSTRATIONS]: "answer",
		};

		for (const { name, lines } of corpus) {
			const hs = headingRefs(lines);
			const blocks = splitBlocks(lines);
			for (const [heading, want] of Object.entries(expected)) {
				const block = blocks.get(heading);
				if (!block) continue;
				for (let line = block.heading; line < block.end; line++) {
					const got = gateForLine(hs, line);
					if (got !== want) leaks.push(`${name}:${line + 1} ${heading} -> ${got}`);
				}
			}
		}

		expect(leaks.slice(0, 10)).toEqual([]);
		expect(leaks.length).toBe(0);
	});

	it("leaves the question and its images visible in every note", () => {
		const hidden: string[] = [];
		for (const { name, lines } of corpus) {
			const hs = headingRefs(lines);
			const blocks = splitBlocks(lines);
			for (const heading of [H_QUESTION]) {
				const block = blocks.get(heading);
				if (!block) continue;
				for (let line = block.heading; line < block.end; line++) {
					if (gateForLine(hs, line) !== "visible") hidden.push(`${name}:${line + 1} ${heading}`);
				}
			}
		}
		expect(hidden.slice(0, 10)).toEqual([]);
		expect(hidden.length).toBe(0);
	});

	it("leaves the title, tag line and preamble of every note visible", () => {
		const hidden: string[] = [];
		for (const { name, lines } of corpus) {
			const hs = headingRefs(lines);
			const first = hs.length ? hs[0].line : lines.length;
			for (let line = 0; line < first; line++) {
				if (gateForLine(hs, line) !== "visible") hidden.push(`${name}:${line + 1}`);
			}
		}
		expect(hidden.slice(0, 10)).toEqual([]);
		expect(hidden.length).toBe(0);
	});
});
