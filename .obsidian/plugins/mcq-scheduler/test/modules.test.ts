import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseModules } from "../src/modules";

const FILE = "/Users/phaneendra/Freedom/Question Modules.md";
const MCQ_DIR = "/Users/phaneendra/Freedom/MCQ";

const defs = parseModules(readFileSync(FILE, "utf8"));
const bank = new Set(
	readdirSync(MCQ_DIR)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.replace(/\.md$/, "")),
);

describe("Question Modules.md", () => {
	it("yields the 2,981 modules", () => {
		expect(defs.length).toBe(2981);
	});

	it("gives every module a unique key", () => {
		expect(new Set(defs.map((d) => d.key)).size).toBe(defs.length);
	});

	it("covers every question in the bank exactly once", () => {
		const ids = defs.flatMap((d) => d.ids);
		expect(ids.length).toBe(12528);
		expect(new Set(ids).size).toBe(12528);
		expect(ids.filter((id) => !bank.has(id)).slice(0, 10)).toEqual([]);
	});

	it("gives every module at least one question and a section", () => {
		expect(defs.filter((d) => d.ids.length === 0 || !d.section).map((d) => d.key)).toEqual([]);
	});

	it("reads a linked topic heading", () => {
		const first = defs[0];
		expect(first.section).toBe("Trauma");
		expect(first.topicSlug).toBe("acetabular-fractures");
		expect(first.topicLabel).toBe("Acetabular Fractures");
		expect(first.ids.slice(0, 2)).toEqual(["OB505", "OB759"]);
	});

	it("reads the headings that have no alias or no link", () => {
		expect(defs.some((d) => d.topicSlug === "Other Pathology Topics")).toBe(true);
		const bare = defs.find((d) => d.topicSlug === "medbullets-onboarding--draft-html");
		expect(bare?.topicLabel).toBe("medbullets-onboarding--draft-html");
	});
});

describe("parseModules", () => {
	it("ignores prose and keeps file order", () => {
		const d = parseModules(
			[
				"# Title",
				"Some intro with [[OB1]] in it.",
				"## Hand",
				"### [[x|X]] (OB 2)",
				"- **A** (OB 1): [[OB1]]",
				"- **B**: [[OB2]], [[TO3]]",
			].join("\n"),
		);
		expect(d.map((m) => [m.key, m.ids, m.order])).toEqual([
			["x::A", ["OB1"], 0],
			["x::B", ["OB2", "TO3"], 1],
		]);
	});
});
