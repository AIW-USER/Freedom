/**
 * Reading an answer block that is still wrapped in a callout.
 *
 * The bank was stripped back to plain markdown once hiding became a rendering
 * concern (see reading.ts), so in practice every block arrives here plain and
 * `unwrapCallout` hands it straight back. It is kept because a note restored
 * from an old backup, or written by hand in the old shape, should still parse
 * rather than take `> [!success]- Answer` for the answer line.
 *
 * Nothing writes callouts any more; this half is read-only.
 */

/** `> [!success]- Answer`. Group 2 is the fold marker: '', '+' or '-'. */
export const RE_CALLOUT_OPENER =
	/^>[ \t]*\[!([A-Za-z0-9_-]+)\]([+-]?)(?:[ \t]+(.*?))?[ \t]*$/;

/** The `> ` that prefixes every line inside a callout. */
const RE_QUOTE_PREFIX = /^>[ \t]?/;

/**
 * A line that was backslash-escaped on the way into a callout, because it
 * opened with a literal greater-than sign (`>50% cortical apposition`, 31 such
 * lines) and would otherwise have nested a blockquote. Unescaped on the way
 * out.
 */
const RE_LEADING_ESCAPED_GT = /^([ \t]*)\\>/;

export interface UnwrappedBlock {
	lines: string[];
	/** 'plain' when the block was never wrapped — now the normal case. */
	state: "plain" | "folded" | "open";
	/** Callout type, when wrapped. */
	type: string | null;
	/** Callout title, when wrapped. */
	title: string | null;
}

/** Drop blank lines from both ends, leaving the interior untouched. */
export function trimBlankEdges(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim() === "") start++;
	while (end > start && lines[end - 1].trim() === "") end--;
	return lines.slice(start, end);
}

/**
 * Take a block out of its callout, if it is in one.
 *
 * Safe to call on an un-wrapped block, in which case it returns the block
 * unchanged with state 'plain' — which is what lets the parser read the bank
 * identically before and after the strip.
 */
export function unwrapCallout(body: string[]): UnwrappedBlock {
	const first = body.findIndex((l) => l.trim() !== "");
	if (first === -1) {
		return { lines: trimBlankEdges(body), state: "plain", type: null, title: null };
	}

	const m = RE_CALLOUT_OPENER.exec(body[first]);
	if (!m) {
		return { lines: trimBlankEdges(body), state: "plain", type: null, title: null };
	}

	const lines: string[] = [];
	for (const line of body.slice(first + 1)) {
		// A blank line terminates the callout; anything after it is outside.
		if (line.trim() === "") {
			lines.push("");
			continue;
		}
		if (!line.startsWith(">")) break;
		lines.push(line.replace(RE_QUOTE_PREFIX, "").replace(RE_LEADING_ESCAPED_GT, "$1>"));
	}

	return {
		lines: trimBlankEdges(lines),
		state: m[2] === "+" ? "open" : "folded",
		type: m[1],
		title: m[3] ?? null,
	};
}
