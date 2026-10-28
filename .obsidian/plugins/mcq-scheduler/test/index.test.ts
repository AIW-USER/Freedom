import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { classify, compareIds } from "../src/index";
import { parseMcq } from "../src/parser";

const MCQ_DIR = "/Users/phaneendra/Freedom/MCQ";

/**
 * Reproduce the shape Obsidian's metadata cache hands us, so `classify` is
 * exercised against realistic input rather than a hand-written fixture.
 *
 * Obsidian's tag rules, as applied here:
 *  - a tag starts at a '#' that is at the start of a line or preceded by
 *    whitespace (so a URL fragment like `.../page#tab2` is NOT a tag);
 *  - the body may contain letters, digits, '_', '-' and '/', and stops at
 *    anything else — which is why `#shoulder&elbow` is cached as `#shoulder`;
 *  - a tag must contain at least one non-digit.
 *
 * `headings` deliberately includes the H1, because that is what broke the
 * original implementation: anchoring the tag filter to `headings[0]` put the
 * cutoff at line 0 and rejected every tag in the vault.
 */
function fakeCache(content: string) {
	const lines = content.split("\n");
	const tags: { tag: string; position: { start: { line: number; col: number } } }[] = [];
	const headings: { heading: string; level: number; position: { start: { line: number } } }[] = [];

	lines.forEach((line, lineNo) => {
		const h = /^(#{1,6})[ \t]+(.*)$/.exec(line);
		if (h) {
			headings.push({
				heading: h[2],
				level: h[1].length,
				position: { start: { line: lineNo } },
			});
			return;
		}
		for (const m of line.matchAll(/(^|\s)#([A-Za-z0-9_/-]+)/g)) {
			const body = m[2];
			if (!/[^0-9]/.test(body)) continue;
			const col = m.index! + m[1].length;
			tags.push({ tag: "#" + body, position: { start: { line: lineNo, col } } });
		}
	});

	return { tags, headings };
}

const files = readdirSync(MCQ_DIR)
	.filter((f) => f.endsWith(".md"))
	.sort();

const rows = files.map((name) => {
	const content = readFileSync(join(MCQ_DIR, name), "utf8");
	return {
		name,
		content,
		cache: fakeCache(content),
		file: { path: `MCQ/${name}`, basename: name.replace(/\.md$/, "") },
	};
});

describe("classify()", () => {
	it("classifies every note in the bank", () => {
		const unclassified = rows.filter(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r) => classify(r.file as any, r.cache as any) === null,
		);
		expect(unclassified.slice(0, 10).map((u) => u.name)).toEqual([]);
		expect(unclassified.length).toBe(0);
	});

	it("agrees with the parser on section and topic for every note", () => {
		const disagreements: string[] = [];
		for (const r of rows) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const entry = classify(r.file as any, r.cache as any);
			if (!entry) continue;
			const mcq = parseMcq(r.file.path, r.content);
			if (entry.section !== mcq.section) {
				disagreements.push(`${r.name}: section ${entry.section} vs ${mcq.section}`);
			}
			if (entry.topic !== mcq.topic) {
				disagreements.push(`${r.name}: topic ${entry.topic} vs ${mcq.topic}`);
			}
			if (entry.family !== mcq.family) {
				disagreements.push(`${r.name}: family ${entry.family} vs ${mcq.family}`);
			}
		}
		expect(disagreements.slice(0, 10)).toEqual([]);
		expect(disagreements.length).toBe(0);
	});

	it("produces the expected section distribution", () => {
		const counts: Record<string, number> = {};
		for (const r of rows) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const entry = classify(r.file as any, r.cache as any);
			if (entry) counts[entry.section] = (counts[entry.section] ?? 0) + 1;
		}
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

	it("folds the differing shoulder/elbow tag spellings into one section", () => {
		// OB and TO have never spelled this section the same way, and the OB
		// spelling has changed more than once: `#shoulder&elbow`, which Obsidian
		// truncates to `#shoulder`, and now `#Shoulderelbow`. TO writes
		// `#shoulderelbow`. The spellings are therefore read off the corpus
		// rather than named here, so renaming the tag in the vault cannot make
		// this test stale again — only an actual failure to fold can.
		const spellings = new Set<string>();
		const families = new Set<string>();

		for (const r of rows) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const entry = classify(r.file as any, r.cache as any);
			if (entry?.section !== "shoulderelbow") continue;
			families.add(entry.family);

			const firstTagLine = Math.min(...r.cache.tags.map((t) => t.position.start.line));
			for (const t of r.cache.tags) {
				if (t.position.start.line !== firstTagLine) continue;
				const bare = t.tag.slice(1);
				if (bare.toLowerCase().startsWith("shoulder")) spellings.add(bare);
			}
		}

		// Both families land in the section, and they got there from more than
		// one raw spelling — which is the whole point of SECTION_ALIASES.
		expect([...families].sort()).toEqual(["OB", "TO"]);
		expect(spellings.size).toBeGreaterThan(1);
	});

	it("flags the AAOS notes without treating AAOS as the topic", () => {
		const aaos = rows.filter((r) => / #AAOS$/m.test(r.content));
		expect(aaos.length).toBe(3050);
		for (const r of aaos.slice(0, 50)) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const entry = classify(r.file as any, r.cache as any)!;
			expect(entry.aaos).toBe(true);
			expect(entry.topic).not.toBe("aaos");
		}
	});
});

describe("compareIds()", () => {
	it("orders numerically within a family", () => {
		expect(["OB10", "OB2", "OB1"].sort(compareIds)).toEqual(["OB1", "OB2", "OB10"]);
	});
});
