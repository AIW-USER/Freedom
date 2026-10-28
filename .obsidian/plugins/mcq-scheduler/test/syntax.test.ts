import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseModules } from "../src/modules";
import { parseMcq } from "../src/parser";

const README = "/Users/phaneendra/Freedom/MCQ syntax.md";

/** The worked example: the first ```markdown block in the README. */
function readmeExample(): string {
	const m = /```markdown\n([\s\S]*?)```/.exec(readFileSync(README, "utf8"));
	expect(m, "no ```markdown example in MCQ syntax.md").not.toBeNull();
	return m![1];
}

describe("MCQ syntax.md", () => {
	it("has a worked example that the plugin parses", () => {
		const mcq = parseMcq("MCQ/MY001.md", readmeExample());
		expect(mcq.id).toBe("MY001");
		expect(mcq.family).toBe("MY");
		expect(mcq.section).toBe("kneesports");
		expect(mcq.topic).toBe("acltear");
		expect(mcq.topicLink).toBe("acl-tear");
		expect(mcq.examLine).toBe("Mock exam 2026 | Question 1");
		expect(mcq.descriptor).toBe("Sports Medicine MCQs — ACL Tear");
		expect(mcq.options.map((o) => o.label)).toEqual(["1", "2", "3", "4"]);
		expect(mcq.correctIndex).toBe(1);
		expect(mcq.questionImages).toEqual(["my001-question.png"]);
		expect(mcq.illustrations).toContain("my001-illustration.png");
	});
});

const minimal = (patch: (s: string) => string = (s) => s) =>
	patch(
		[
			"# X1",
			"",
			"#XY #spine #ankylosingspondylitis",
			"",
			"## Question",
			"",
			"Stem?",
			"",
			"## Options",
			"",
			"1. One",
			"2. Two",
			"",
			"## Correct option",
			"",
			"**2. Two**",
			"",
			"## Answer explanation",
			"",
			"Because.",
			"",
		].join("\n"),
	);

describe("the parser's error messages", () => {
	it("accepts the smallest valid note, with an unfamiliar source code", () => {
		const mcq = parseMcq("MCQ/X1.md", minimal());
		expect(mcq.family).toBe("XY");
		expect(mcq.correctIndex).toBe(1);
	});

	it("accepts an unknown answer", () => {
		const mcq = parseMcq(
			"MCQ/X1.md",
			minimal((s) => s.replace("**2. Two**", "Not provided by the source.")),
		);
		expect(mcq.correctIndex).toBeNull();
	});

	it("rejects lettered options", () => {
		expect(() => parseMcq("MCQ/X1.md", minimal((s) => s.replace("1. One", "- a. One")))).toThrow(
			/option line is not "N\. text"/,
		);
	});

	it("rejects a gap in the option numbering", () => {
		expect(() => parseMcq("MCQ/X1.md", minimal((s) => s.replace("2. Two", "3. Two")))).toThrow(
			/numbered 3 where 2 was expected/,
		);
	});

	it("rejects a correct option that is not bold and numbered", () => {
		expect(() => parseMcq("MCQ/X1.md", minimal((s) => s.replace("**2. Two**", "b. Two")))).toThrow(
			/correct option is not/,
		);
	});

	it("rejects a tag line that does not start with the source", () => {
		expect(() =>
			parseMcq("MCQ/X1.md", minimal((s) => s.replace("#XY #spine", "#spine #XY"))),
		).toThrow(/must start with a source tag/);
	});

	it("rejects a stray line above the question", () => {
		expect(() =>
			parseMcq("MCQ/X1.md", minimal((s) => s.replace("#ankylosingspondylitis\n", "#ankylosingspondylitis\nFrom my notes\n"))),
		).toThrow(/unexpected line above '## Question'/);
	});

	it("names a missing section", () => {
		expect(() =>
			parseMcq("MCQ/X1.md", minimal((s) => s.replace("## Options", "## Choices"))),
		).toThrow(/missing '## Options'/);
	});
});

describe("MCQ module syntax.md", () => {
	it("has a worked example that the modules parser reads as documented", () => {
		const text = readFileSync("/Users/phaneendra/Freedom/MCQ module syntax.md", "utf8");
		const m = /```markdown\n([\s\S]*?)```/.exec(text);
		expect(m, "no ```markdown example in MCQ module syntax.md").not.toBeNull();
		const defs = parseModules(m![1]);
		expect(defs.map((d) => [d.key, d.section, d.topicLabel, d.ids])).toEqual([
			["acl-tear::Graft choice & tunnel placement", "Trauma", "ACL Tear", ["OB1", "OB2", "TO17099138"]],
			["acl-tear::Return to sport", "Trauma", "ACL Tear", ["OB3"]],
			["Other Knee Topics::Miscellaneous", "Trauma", "Other Knee Topics", ["OB4"]],
		]);
	});
});
