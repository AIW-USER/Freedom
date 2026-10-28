import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMcq } from "../src/parser";
import { canonicalTopic, TOPIC_ALIASES } from "../src/topic-aliases";
import { SECTIONS, topicKey } from "../src/types";

const MCQ_DIR = "/Users/phaneendra/Freedom/MCQ";

/** Raw topic tag as written on each note's tag line, before any folding. */
const rawTopic = new Map<string, string>();
const families = new Map<string, Set<string>>();
const keys = new Set<string>();

for (const name of readdirSync(MCQ_DIR)) {
	if (!name.endsWith(".md")) continue;
	const content = readFileSync(join(MCQ_DIR, name), "utf8");
	const mcq = parseMcq(`MCQ/${name}`, content);
	const key = topicKey(mcq.section, mcq.topic);
	keys.add(key);
	const fams = families.get(key) ?? new Set();
	fams.add(mcq.family);
	families.set(key, fams);

	const line = content.split("\n").find((l) => /^#(OB|[a-z&]+) #/i.test(l)) ?? "";
	const tags = line.split(/\s+/).map((t) => t.replace(/^#/, "").toLowerCase());
	rawTopic.set(name, tags[2] ?? "");
}

describe("topic aliases", () => {
	it("points every alias at a topic that exists, in a real section", () => {
		const bad = Object.entries(TOPIC_ALIASES).filter(
			([, t]) => !SECTIONS.includes(t.section) || !keys.has(topicKey(t.section, t.topic)),
		);
		expect(bad).toEqual([]);
	});

	it("never chains: a target is not itself redirected elsewhere", () => {
		const chained = Object.entries(TOPIC_ALIASES).filter(([, to]) => {
			const next = TOPIC_ALIASES[to.topic];
			// A target may itself be a key that only moves that tag's section,
			// as long as it resolves to the very same place.
			return next !== undefined && (next.topic !== to.topic || next.section !== to.section);
		});
		expect(chained).toEqual([]);
	});

	it("leaves no note carrying an old spelling", () => {
		const stale = [...rawTopic].filter(([, tag]) => {
			const target = TOPIC_ALIASES[tag];
			return target !== undefined && target.topic !== tag;
		});
		expect(stale.slice(0, 10)).toEqual([]);
	});

	it("lists no topic name under two sections", () => {
		const topics = [...keys].map((k) => k.slice(k.indexOf("/") + 1));
		expect(topics.length).toBe(new Set(topics).size);
	});

	it("files every Target Ortho question under an Orthobullets topic", () => {
		const both = [...families].filter(([, f]) => f.size === 2).map(([k]) => k);
		expect(both).toContain("kneesports/acltear");
		expect(both).toContain("pediatrics/slippedcapitalfemoralepiphysisscfe");
		expect(both.length).toBe(420);
		const toOnly = [...families].filter(([, f]) => f.size === 1 && f.has("TO"));
		expect(toOnly).toEqual([]);
	});

	it("folds an old spelling and passes anything else through", () => {
		expect(canonicalTopic("kneesports", "acl")).toEqual({ section: "kneesports", topic: "acltear" });
		expect(canonicalTopic("trauma", "lisfrancinjury")).toEqual({
			section: "footankle",
			topic: "lisfrancinjury",
		});
		expect(canonicalTopic("trauma", "polytraumax")).toEqual({ section: "trauma", topic: "polytraumax" });
	});
});
