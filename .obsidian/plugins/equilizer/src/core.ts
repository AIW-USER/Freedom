// Pure range logic: no obsidian imports, so vitest can run it directly.

/**
 * A run of characters on one line of one file.
 * `line` is 1-based. `start`/`end` are 0-based column offsets, `end` exclusive,
 * so an empty range has start === end.
 * The settings box shows it as `path|line|first-last` with 1-based inclusive
 * columns (`MCQ/OB1.md|12|5-20`).
 */
export interface Endpoint {
	path: string;
	line: number;
	start: number;
	end: number;
}

/** Shortest timed check allowed, so a typo can't make the plugin read files constantly. */
export const MIN_INTERVAL_MS = 250;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <T>(error: string): Result<T> => ({ ok: false, error });

export function parseEndpoint(raw: string): Result<Endpoint> {
	const parts = raw.split("|").map((p) => p.trim());
	if (parts.length !== 3) return err('Write it as "file path|line|start-end"');
	const [path, lineStr, range] = parts;
	if (!path) return err("File path is empty");
	if (!/^\d+$/.test(lineStr)) return err(`Line "${lineStr}" is not a number`);
	const line = Number(lineStr);
	if (line < 1) return err("Lines are counted from 1");
	const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(range);
	if (!m) return err(`Characters "${range}" should look like 5-20`);
	const first = Number(m[1]);
	const last = m[2] === undefined ? first : Number(m[2]);
	if (first < 1) return err("Characters are counted from 1");
	// last === first - 1 is allowed: it is how an empty range is written.
	if (last < first - 1) return err(`Characters ${range} end before they start`);
	return ok({ path, line, start: first - 1, end: last });
}

export function formatEndpoint(e: Endpoint): string {
	return `${e.path}|${e.line}|${e.start + 1}-${e.end}`;
}

/** Absolute offsets of a line's content (without its "\n" or "\r\n"). */
function lineBounds(text: string, line: number): { from: number; to: number } | null {
	let from = 0;
	for (let i = 1; i < line; i++) {
		const nl = text.indexOf("\n", from);
		if (nl === -1) return null;
		from = nl + 1;
	}
	let to = text.indexOf("\n", from);
	if (to === -1) to = text.length;
	if (to > from && text[to - 1] === "\r") to--;
	return { from, to };
}

function lineCount(text: string): number {
	return text.split("\n").length;
}

/** Absolute offsets of an endpoint inside `text`. */
export function locate(text: string, e: Endpoint): Result<{ from: number; to: number }> {
	const b = lineBounds(text, e.line);
	if (!b) return err(`Line ${e.line} does not exist (${e.path} has ${lineCount(text)} lines)`);
	const len = b.to - b.from;
	if (e.end > len) {
		return err(`Characters ${e.start + 1}-${e.end} run past the end of line ${e.line} (${len} characters)`);
	}
	return ok({ from: b.from + e.start, to: b.from + e.end });
}

export function readRange(text: string, e: Endpoint): Result<string> {
	const loc = locate(text, e);
	return loc.ok ? ok(text.slice(loc.value.from, loc.value.to)) : loc;
}

/** Replace the range with `value`; the returned endpoint covers the new value. */
export function writeRange(text: string, e: Endpoint, value: string): Result<{ text: string; endpoint: Endpoint }> {
	const loc = locate(text, e);
	if (!loc.ok) return loc;
	if (/[\r\n]/.test(value)) return err("A synced range cannot contain a line break");
	return ok({
		text: text.slice(0, loc.value.from) + value + text.slice(loc.value.to),
		endpoint: { ...e, end: e.start + value.length },
	});
}

/**
 * Where does the range sit after `oldText` was edited into `newText`?
 * Lines are aligned first: unchanged lines above and below the edit are
 * matched, so the range follows its line when lines are added or removed
 * elsewhere, even in the same save as an edit to the range itself. Within the
 * range's line, `trackLineEdit` decides how the columns move.
 */
export function trackEdit(oldText: string, newText: string, e: Endpoint): Endpoint {
	if (oldText === newText) return e;
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const row = e.line - 1;
	if (row >= oldLines.length) return e;

	const max = Math.min(oldLines.length, newLines.length);
	let top = 0;
	while (top < max && oldLines[top] === newLines[top]) top++;
	let bottom = 0;
	while (bottom < max - top && oldLines[oldLines.length - 1 - bottom] === newLines[newLines.length - 1 - bottom]) bottom++;
	if (row < top) return e;
	if (row >= oldLines.length - bottom) return { ...e, line: e.line + newLines.length - oldLines.length };

	// The range's line is inside the changed block. Pair it with the new line
	// that shares the most leading + trailing characters, nearest its old place.
	const oldLine = oldLines[row];
	let best = -1;
	let bestScore = 0;
	for (let j = top; j < newLines.length - bottom; j++) {
		const score = sharedEnds(oldLine, newLines[j]) * 1000 - Math.abs(j - row);
		if (score > bestScore) [best, bestScore] = [j, score];
	}
	if (best === -1 || sharedEnds(oldLine, newLines[best]) === 0) return trackCharEdit(oldText, newText, e);
	const moved = trackCharEdit(oldLine, newLines[best], { ...e, line: 1 });
	return { ...moved, line: best + 1 };
}

function sharedEnds(a: string, b: string): number {
	const max = Math.min(a.length, b.length);
	let p = 0;
	while (p < max && a[p] === b[p]) p++;
	let s = 0;
	while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
	return p + s;
}

/**
 * Character-level tracking. The edit is the span between the texts' common
 * prefix and suffix.
 * - edit wholly before the range: the range shifts (columns and/or lines)
 * - edit wholly after it: nothing moves
 * - edit inside it (typing at either boundary counts as inside): the end moves
 *   by the change in length, so the range grows or shrinks with the text
 * - edit straddling a boundary: the range widens to cover the edit
 * A range that would now cross a line break is cut at the end of its line.
 */
function trackCharEdit(oldText: string, newText: string, e: Endpoint): Endpoint {
	const loc = locate(oldText, e);
	if (!loc.ok) return e;
	let { from: s, to: en } = loc.value;

	const max = Math.min(oldText.length, newText.length);
	const same = (i: number, j: number) => oldText[i] === newText[j];
	// Longest common prefix first…
	let p = 0;
	while (p < max && same(p, p)) p++;
	let suf = 0;
	while (suf < max - p && same(oldText.length - 1 - suf, newText.length - 1 - suf)) suf++;
	const delta = newText.length - oldText.length;
	const oldSpan = oldText.length - suf - p;
	// …but a pure insertion or deletion can slide left over repeated text
	// ("HELLO y" → "HELLO THERE y" is " THERE" after HELLO or "THERE " after the
	// space). Anywhere in [lo, p] is a valid reading; prefer one that touches the
	// range, so typing at its edge extends it.
	if (oldSpan === 0 || oldSpan + delta === 0) {
		// The leftmost reading keeps the longest common suffix.
		let sufMax = 0;
		while (sufMax < max && same(oldText.length - 1 - sufMax, newText.length - 1 - sufMax)) sufMax++;
		const lo = max - sufMax;
		// Place the edit so it ends at the range's end, else starts at its start.
		const atEnd = en - oldSpan;
		if (atEnd >= lo && atEnd <= p && atEnd >= s) p = atEnd;
		else if (s >= lo && s <= p) p = s;
	}
	const oldEditEnd = p + oldSpan;

	if (p < s && oldEditEnd <= s) {
		s += delta;
		en += delta;
	} else if (p > en || (p === en && oldEditEnd > en)) {
		// after the range
	} else {
		const ns = Math.min(s, p);
		en = Math.max(en, oldEditEnd) + delta;
		s = ns;
	}

	const lineStart = s === 0 ? 0 : newText.lastIndexOf("\n", s - 1) + 1;
	const line = lineCount(newText.slice(0, lineStart));
	const bounds = lineBounds(newText, line)!;
	en = Math.max(s, Math.min(en, bounds.to));
	return { path: e.path, line, start: s - lineStart, end: en - lineStart };
}
