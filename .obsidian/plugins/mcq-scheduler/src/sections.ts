/**
 * Which `## ` section of an MCQ note a given source line belongs to, and what
 * the reading view should do with it.
 *
 * Pure string/number work with no Obsidian import, so the whole hiding policy
 * is testable against the real 12,528-note bank without an app instance. The
 * post-processor in reading.ts is the only thing that turns these answers into
 * DOM classes.
 */

import { H_CORRECT, H_EXPLANATION, H_ILLUSTRATIONS, H_OPTIONS, RE_H2 } from "./parser";

/**
 * - `always`  — hidden in reading view and never revealed. The only way to see
 *               it is source mode.
 * - `answer`  — hidden until the question is answered in the side pane.
 * - `visible` — rendered normally.
 */
export type Gate = "always" | "answer" | "visible";

/** A `## ` heading and the 0-based line it sits on. Mirrors CachedMetadata.headings. */
export interface HeadingRef {
	heading: string;
	line: number;
}

/**
 * The options are already in the side pane, and the correct option is what the
 * pane's grading says — rendering either in the note only spoils the question
 * sitting above them.
 */
const GATED_ALWAYS: ReadonlySet<string> = new Set([H_OPTIONS, H_CORRECT]);

/** Answer material: it appears the moment you commit to an option. */
const GATED_ON_ANSWER: ReadonlySet<string> = new Set([H_EXPLANATION, H_ILLUSTRATIONS]);

/**
 * Every `## ` heading in a note, in file order.
 *
 * Only used when Obsidian's metadata cache has nothing for the file yet;
 * normally the cache supplies the same list for free. RE_H2 matches a level-2
 * heading only — `### Foo` has a `#` where the pattern wants whitespace — so an
 * H3 inside a long explanation cannot re-attribute the blocks beneath it.
 */
export function headingRefs(lines: string[]): HeadingRef[] {
	const out: HeadingRef[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = RE_H2.exec(lines[i]);
		if (m) out.push({ heading: m[1], line: i });
	}
	return out;
}

/**
 * The nearest heading at or above `line`, or null for anything above the first
 * one (the H1, the tag line, `Topic:`/`Exam:`/`Source:`).
 *
 * A heading line resolves to *itself*, which is the load-bearing case: it means
 * the rendered `<h2>` for `## Correct option` is gated along with its body, so
 * hiding leaves no orphan heading behind.
 */
export function headingAtLine(headings: readonly HeadingRef[], line: number): string | null {
	let found: string | null = null;
	for (const h of headings) {
		if (h.line > line) break;
		found = h.heading;
	}
	return found;
}

/** The policy, in one place. Unknown headings render normally. */
export function gateForHeading(heading: string | null): Gate {
	if (heading === null) return "visible";
	if (GATED_ALWAYS.has(heading)) return "always";
	if (GATED_ON_ANSWER.has(heading)) return "answer";
	return "visible";
}

/** The one call the post-processor makes. */
export function gateForLine(headings: readonly HeadingRef[], line: number): Gate {
	return gateForHeading(headingAtLine(headings, line));
}
