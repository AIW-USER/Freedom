import { trimBlankEdges, unwrapCallout } from "./callouts";
import { canonicalTopic } from "./topic-aliases";
import {
	Family,
	MCQ,
	McqParseError,
	MCQOption,
	META_TAGS,
	Section,
	SECTION_ALIASES,
} from "./types";

export const RE_H1 = /^#[ \t]+(\S+)[ \t]*$/;
export const RE_H2 = /^##[ \t]+(.+?)[ \t]*$/;
/**
 * A tag body. Obsidian allows digits inside a tag and even at the start
 * (`#5thmetatarsalbasefracture` is real, and there are 32 such files), but a
 * tag may not be all digits — hence the lookahead for at least one letter.
 */
const TAG_BODY = "(?=[\\w&/-]*[A-Za-z])[\\w&/-]+";
/** A line made up of nothing but two or more tags. */
export const RE_TAGLINE = new RegExp(`^#${TAG_BODY}(?:[ \\t]+#${TAG_BODY})+[ \\t]*$`);
export const RE_TAG = new RegExp(`#(${TAG_BODY})`, "g");
export const RE_TOPICLINK = /^Topic:[ \t]*\[\[([^\]|#^]+?)(?:[|#^][^\]]*)?\]\][ \t]*$/;
export const RE_EXAM = /^Exam:[ \t]*(.+?)[ \t]*$/;
export const RE_SOURCE = /^Source:[ \t]*(\S+)[ \t]*$/;
export const RE_CHAPTER = /^Chapter:[ \t]*(.+?)[ \t]*$/;
/** The source tag that opens the tag line: `#OB`, `#TO`, or any new 2–5 letter code. */
export const RE_SOURCE_TAG = /^[A-Za-z]{2,5}$/;
export const RE_OPTION = /^(\d+)\.[ \t]+(.*)$/;
export const RE_CORRECT = /^\*\*(\d+)\.[ \t]*(.*?)\*\*[ \t]*$/;
export const RE_UNANSWERED = /^Not provided by the source\.[ \t]*$/;
export const RE_EMBED = /!\[\[([^\]|#^]+?)(?:[|#^][^\]]*)?\]\]/g;

export const H_QUESTION = "Question";
export const H_OPTIONS = "Options";
export const H_CORRECT = "Correct option";
export const H_EXPLANATION = "Answer explanation";
export const H_ILLUSTRATIONS = "Illustrations";

export interface Block {
	/** Index of the `## ` line itself. */
	heading: number;
	/** First line of the body. */
	start: number;
	/** One past the last line of the body. */
	end: number;
	lines: string[];
}

/** Split a note into its `## ` blocks, keyed by heading text. */
export function splitBlocks(lines: string[]): Map<string, Block> {
	const headings: { text: string; index: number }[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = RE_H2.exec(lines[i]);
		if (m) headings.push({ text: m[1], index: i });
	}

	const blocks = new Map<string, Block>();
	for (let h = 0; h < headings.length; h++) {
		const start = headings[h].index + 1;
		const end = h + 1 < headings.length ? headings[h + 1].index : lines.length;
		blocks.set(headings[h].text, {
			heading: headings[h].index,
			start,
			end,
			lines: lines.slice(start, end),
		});
	}
	return blocks;
}

function collectEmbeds(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(RE_EMBED)) out.push(m[1].trim());
	return out;
}

function parseOptions(path: string, body: string[]): MCQOption[] {
	const options: MCQOption[] = [];
	for (const line of body) {
		if (line.trim() === "") continue;
		const m = RE_OPTION.exec(line);
		if (!m) {
			throw new McqParseError(path, `option line is not "N. text": ${JSON.stringify(line)}`);
		}
		const expected = String(options.length + 1);
		if (m[1] !== expected) {
			throw new McqParseError(path, `option numbered ${m[1]} where ${expected} was expected`);
		}
		options.push({ index: options.length, label: m[1], text: m[2].trim() });
	}
	if (options.length < 2) {
		throw new McqParseError(path, `only ${options.length} option(s) found`);
	}
	return options;
}

/**
 * Parse one MCQ note. The syntax is documented for people in `MCQ syntax.md`
 * at the vault root; test/syntax.test.ts parses that file's example, so the
 * two cannot drift apart.
 *
 * The bank is plain markdown: hiding happens as a note renders, not in the
 * file. A note still carrying the old answer callouts — one restored from a
 * backup, say — reads identically, because every answer block goes through
 * `unwrapCallout` on the way out.
 */
export function parseMcq(path: string, content: string): MCQ {
	const lines = content.split("\n");

	const h1Index = lines.findIndex((l) => RE_H1.test(l));
	if (h1Index === -1) throw new McqParseError(path, "no H1 title line");
	const id = RE_H1.exec(lines[h1Index])![1];

	const firstHeading = lines.findIndex((l) => RE_H2.test(l));
	if (firstHeading === -1) throw new McqParseError(path, "no '## ' headings");

	// --- tags -------------------------------------------------------------
	const tagLineIndex = lines.findIndex(
		(l, i) => i > h1Index && i < firstHeading && RE_TAGLINE.test(l),
	);
	if (tagLineIndex === -1) throw new McqParseError(path, "no tag line before the first heading");

	const allTags = [...lines[tagLineIndex].matchAll(RE_TAG)].map((m) => m[1]);
	// The first tag names the source, by position rather than by name, so a
	// new bank only needs a new code.
	const family: Family = allTags[0].toUpperCase();
	if (!RE_SOURCE_TAG.test(allTags[0]) || SECTION_ALIASES[allTags[0].toLowerCase()]) {
		throw new McqParseError(
			path,
			`the tag line must start with a source tag such as #OB, not #${allTags[0]}`,
		);
	}
	const tags = allTags.slice(1);

	let section: Section | null = null;
	let topic: string | null = null;
	const extraTags: string[] = [];
	for (const tag of tags) {
		const lower = tag.toLowerCase();
		const asSection = SECTION_ALIASES[lower];
		if (asSection && section === null) {
			section = asSection;
			continue;
		}
		if (META_TAGS.has(lower)) {
			extraTags.push(tag);
			continue;
		}
		if (topic === null) {
			topic = lower;
			continue;
		}
		extraTags.push(tag);
	}
	if (section === null) throw new McqParseError(path, `no section tag in [${tags.join(", ")}]`);
	if (topic === null) throw new McqParseError(path, `no topic tag in [${tags.join(", ")}]`);
	// Synonymous tags from the two banks list as one topic.
	({ section, topic } = canonicalTopic(section, topic));

	// --- preamble ----------------------------------------------------------
	let examLine: string | null = null;
	let sourceUrl: string | null = null;
	let topicLink: string | null = null;
	let descriptor: string | null = null;
	for (let i = h1Index + 1; i < firstHeading; i++) {
		const line = lines[i];
		if (line.trim() === "" || i === tagLineIndex) continue;
		const exam = RE_EXAM.exec(line);
		if (exam) {
			examLine = exam[1];
			continue;
		}
		const src = RE_SOURCE.exec(line);
		if (src) {
			sourceUrl = src[1];
			continue;
		}
		const link = RE_TOPICLINK.exec(line);
		if (link) {
			topicLink = link[1];
			continue;
		}
		const chapter = RE_CHAPTER.exec(line);
		if (chapter) {
			descriptor = chapter[1];
			continue;
		}
		throw new McqParseError(
			path,
			`unexpected line above '## Question' (only Topic:, Exam:, Source: and Chapter: go there): ${JSON.stringify(line)}`,
		);
	}

	// --- blocks -------------------------------------------------------------
	const blocks = splitBlocks(lines);
	for (const required of [H_QUESTION, H_OPTIONS, H_CORRECT, H_EXPLANATION]) {
		if (!blocks.has(required)) throw new McqParseError(path, `missing '## ${required}'`);
	}

	const questionBlock = blocks.get(H_QUESTION)!;
	const questionRaw = trimBlankEdges(questionBlock.lines).join("\n");
	const questionText = questionRaw
		.split("\n")
		.filter((l) => !l.trim().startsWith("![[") && !/^\*.*\*$/.test(l.trim()))
		.join("\n")
		.trim();
	const questionImages = collectEmbeds(questionRaw);

	const options = parseOptions(path, blocks.get(H_OPTIONS)!.lines);

	// --- correct option ------------------------------------------------------
	const correctUnwrapped = unwrapCallout(blocks.get(H_CORRECT)!.lines);
	const correctRaw = correctUnwrapped.lines.find((l) => l.trim() !== "")?.trim() ?? "";
	if (correctRaw === "") throw new McqParseError(path, "empty '## Correct option' body");

	let correctIndex: number | null = null;
	if (!RE_UNANSWERED.test(correctRaw)) {
		const m = RE_CORRECT.exec(correctRaw);
		if (!m) {
			throw new McqParseError(
				path,
				`correct option is not "**N. text**" or "Not provided by the source.": ${JSON.stringify(correctRaw)}`,
			);
		}
		const found = options.findIndex((o) => o.label === m[1]);
		if (found === -1) {
			throw new McqParseError(
				path,
				`correct option label '${m[1]}' is not among [${options.map((o) => o.label).join(", ")}]`,
			);
		}
		correctIndex = found;
	}

	const explanationUnwrapped = unwrapCallout(blocks.get(H_EXPLANATION)!.lines);
	const illustrationsBlock = blocks.get(H_ILLUSTRATIONS);
	const illustrationsUnwrapped = illustrationsBlock
		? unwrapCallout(illustrationsBlock.lines)
		: null;

	return {
		id,
		path,
		family,
		section,
		topic,
		extraTags,
		examLine,
		descriptor,
		sourceUrl,
		topicLink,
		questionText,
		questionImages,
		options,
		correctIndex,
		correctRaw,
		explanation: explanationUnwrapped.lines.join("\n"),
		illustrations: illustrationsUnwrapped ? illustrationsUnwrapped.lines.join("\n") : null,
		hide: {
			correct: correctUnwrapped.state,
			explanation: explanationUnwrapped.state,
			illustrations: illustrationsBlock
				? (illustrationsUnwrapped!.state as "plain" | "folded" | "open")
				: "absent",
		},
	};
}
