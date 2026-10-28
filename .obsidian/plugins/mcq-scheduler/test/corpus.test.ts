import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RE_CALLOUT_OPENER } from "../src/callouts";
import { parseMcq } from "../src/parser";
import { MCQ, topicKey } from "../src/types";

const MCQ_DIR = "/Users/phaneendra/Freedom/MCQ";

const files = readdirSync(MCQ_DIR)
	.filter((f) => f.endsWith(".md"))
	.sort();

interface Loaded {
	name: string;
	content: string;
	mcq: MCQ;
}

const loaded: Loaded[] = [];
const failures: { name: string; error: string }[] = [];

for (const name of files) {
	const content = readFileSync(join(MCQ_DIR, name), "utf8");
	try {
		loaded.push({ name, content, mcq: parseMcq(`MCQ/${name}`, content) });
	} catch (e) {
		failures.push({ name, error: String(e) });
	}
}

describe("corpus", () => {
	it("finds every markdown file", () => {
		expect(files.length).toBe(12528);
	});

	it("parses every file without error", () => {
		expect(failures.slice(0, 10)).toEqual([]);
		expect(failures.length).toBe(0);
	});

	it("splits into the two known families", () => {
		const ob = loaded.filter((l) => l.mcq.family === "OB").length;
		const to = loaded.filter((l) => l.mcq.family === "TO").length;
		expect({ ob, to }).toEqual({ ob: 9786, to: 2742 });
	});

	it("gives every file an id matching its basename", () => {
		const bad = loaded.filter((l) => l.mcq.id !== l.name.replace(/\.md$/, ""));
		expect(bad.map((b) => b.name)).toEqual([]);
	});

	it("resolves a section for every file, with the expected distribution", () => {
		const counts: Record<string, number> = {};
		for (const l of loaded) counts[l.mcq.section] = (counts[l.mcq.section] ?? 0) + 1;
		expect(counts).toEqual({
			trauma: 2014,
			pediatrics: 1471,
			basics: 1312,
			recon: 1354,
			spine: 1339,
			kneesports: 1104,
			pathology: 1001,
			shoulderelbow: 1179,
			footankle: 889,
			hand: 865,
		});
	});

	it("resolves a topic for every file", () => {
		const bad = loaded.filter((l) => !l.mcq.topic || l.mcq.topic.length === 0);
		expect(bad.map((b) => b.name)).toEqual([]);
		const topics = new Set(loaded.map((l) => l.mcq.topic));
		const keys = new Set(loaded.map((l) => topicKey(l.mcq.section, l.mcq.topic)));
		// Every Target Ortho question sits under an Orthobullets topic
		// (topic-aliases.ts), so no topic name is reused across sections; the index stays keyed by
		// section/topic so a future clash cannot merge two topics silently.
		expect(topics.size).toBe(761);
		expect(keys.size).toBe(761);
	});

	it("never mistakes a stray inline tag for the topic", () => {
		// OB1222 has a '#tab2' URL fragment in its body.
		const ob1222 = loaded.find((l) => l.name === "OB1222.md")!;
		expect(ob1222.mcq.topic).not.toBe("tab2");
	});

	it("yields 3-5 options per file, in the known distribution", () => {
		const counts: Record<number, number> = {};
		for (const l of loaded) counts[l.mcq.options.length] = (counts[l.mcq.options.length] ?? 0) + 1;
		expect(counts).toEqual({ 3: 5, 4: 2971, 5: 9552 });
	});

	it("resolves a correct answer for all but the 95 unrecorded files", () => {
		const unanswered = loaded.filter((l) => l.mcq.correctIndex === null);
		expect(unanswered.length).toBe(95);
		expect(unanswered.every((l) => l.mcq.family === "TO")).toBe(true);
	});

	it("points correctIndex at an option whose text matches the answer line", () => {
		const mismatches: string[] = [];
		for (const l of loaded) {
			if (l.mcq.correctIndex === null) continue;
			const opt = l.mcq.options[l.mcq.correctIndex];
			const answerText = l.mcq.correctRaw
				.replace(/^\*\*/, "")
				.replace(/\*\*$/, "")
				.replace(/^[0-9a-z]+\.[ \t]*/, "")
				.trim();
			if (answerText !== opt.text.trim()) mismatches.push(`${l.name}: ${answerText} != ${opt.text}`);
		}
		expect(mismatches.slice(0, 10)).toEqual([]);
	});

	it("reads the bank consistently whether or not it has been migrated", () => {
		// The parser must cope with both states, so this asserts uniformity
		// rather than a particular state.
		const states = new Set(loaded.map((l) => l.mcq.hide.correct));
		expect(states.size).toBe(1);
		expect(["plain", "folded", "open"]).toContain([...states][0]);
	});
});

describe("the standard syntax (MCQ syntax.md)", () => {
	it("opens every tag line with the source tag that matches the file name", () => {
		const bad = loaded.filter((l) => !l.name.startsWith(l.mcq.family));
		expect(bad.slice(0, 10).map((l) => `${l.name}: ${l.mcq.family}`)).toEqual([]);
	});

	it("numbers every option 1..n, with no lettered options left", () => {
		const bad = loaded.filter(
			(l) =>
				l.mcq.options.some((o, i) => o.label !== String(i + 1)) ||
				/^-[ \t]+[a-z]\.[ \t]/m.test(l.content),
		);
		expect(bad.slice(0, 10).map((l) => l.name)).toEqual([]);
	});

	it("has no '## Question images' heading — question images go inline", () => {
		const bad = loaded.filter((l) => /^## Question images\s*$/m.test(l.content));
		expect(bad.slice(0, 10).map((l) => l.name)).toEqual([]);
	});

	it("keeps the TO chapter on a Chapter: line", () => {
		const to = loaded.filter((l) => l.mcq.family === "TO");
		expect(to.filter((l) => !l.mcq.descriptor).map((l) => l.name).slice(0, 10)).toEqual([]);
	});

	it("left no lettered 'Answer: B' line in a TO explanation", () => {
		const bad = loaded.filter(
			(l) => l.mcq.family === "TO" && /^Answer:[ \t]*[A-Ea-e](?:$|[\s(:.,])/m.test(l.mcq.explanation),
		);
		expect(bad.slice(0, 10).map((l) => l.name)).toEqual([]);
	});
});

describe("the stripped bank", () => {
	it("has no answer callout left anywhere", () => {
		const wrapped: string[] = [];
		for (const l of loaded) {
			if (l.content.split("\n").some((line) => RE_CALLOUT_OPENER.test(line))) wrapped.push(l.name);
		}
		expect(wrapped.slice(0, 10)).toEqual([]);
		expect(wrapped.length).toBe(0);
	});

	it("reports every answer block as plain text", () => {
		const odd = loaded.filter(
			(l) => l.mcq.hide.correct !== "plain" || l.mcq.hide.explanation !== "plain",
		);
		expect(odd.map((o) => o.name)).toEqual([]);
	});

	it("left no backslash-escaped '>' behind when the quoting came off", () => {
		// The 31 lines that open with a literal '>' were escaped on the way into
		// a callout. If unescaping had missed one it would be visible here.
		const offenders = loaded.filter((l) => /^[ \t]*\\>/m.test(l.content));
		expect(offenders.map((o) => o.name)).toEqual([]);
	});

	it("restores the literal greater-than lines to column 0", () => {
		// OB3310's explanation contains '>50% cortical apposition'. Back in plain
		// text Obsidian renders it as a blockquote, exactly as it did before the
		// bank was ever migrated.
		const ob3310 = loaded.find((l) => l.name === "OB3310.md")!;
		expect(ob3310.mcq.explanation.split("\n").some((line) => line.startsWith(">50%"))).toBe(true);
	});
});
