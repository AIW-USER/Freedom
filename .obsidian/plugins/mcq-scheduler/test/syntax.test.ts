import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseModules } from "../src/modules";
import { parseMcq } from "../src/parser";

const README = "/Users/phaneendra/Freedom/README.md";

/**
 * The worked example from the former MCQ syntax.md, kept here since that
 * note left the vault, so the documented syntax stays under test.
 */
const MCQ_EXAMPLE = `# MY001

#MY #kneesports #acltear
Topic: [[acl-tear]]
Exam: Mock exam 2026 | Question 1
Source: https://www.orthobullets.com/knee-and-sports/3008/acl-tear
Chapter: Sports Medicine MCQs — ACL Tear

## Question

During ACL reconstruction, a graft that is tight in flexion but lax in extension is most likely due to which error?

![[my001-question.png]]

## Options

1. Femoral tunnel too posterior
2. Femoral tunnel too anterior
3. Tibial tunnel too anterior
4. Tibial tunnel too medial

## Correct option

**2. Femoral tunnel too anterior**

## Answer explanation

An anterior femoral tunnel tightens the graft in flexion because of the cam effect of the femoral condyle.

Answer: 2

## Illustrations

![[my001-illustration.png]]
*Illustration A*
`;

function readmeExample(): string {
	return MCQ_EXAMPLE;
}

describe("MCQ syntax worked example", () => {
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

describe("README.md, MCQ module syntax", () => {
	it("has a worked example that the modules parser reads as documented", () => {
		const text = readFileSync(README, "utf8");
		const m = /```markdown\n(# OB Concept Modules[\s\S]*?)```/.exec(text);
		expect(m, "no module-syntax ```markdown example in README.md").not.toBeNull();
		const defs = parseModules(m![1]);
		expect(defs.map((d) => [d.key, d.section, d.topicLabel, d.ids])).toEqual([
			["acl-tear::Graft choice & tunnel placement", "Trauma", "ACL Tear", ["OB1", "OB2", "TO17099138"]],
			["acl-tear::Return to sport", "Trauma", "ACL Tear", ["OB3"]],
			["Other Knee Topics::Miscellaneous", "Trauma", "Other Knee Topics", ["OB4"]],
		]);
	});
});
