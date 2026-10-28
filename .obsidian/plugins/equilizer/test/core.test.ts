import { describe, expect, it } from "vitest";
import { Endpoint, formatEndpoint, parseEndpoint, readRange, trackEdit, writeRange } from "../src/core";

const ep = (line: number, start: number, end: number, path = "a.md"): Endpoint => ({ path, line, start, end });

describe("parseEndpoint", () => {
	it("parses path|line|start-end into 0-based, end-exclusive columns", () => {
		expect(parseEndpoint(" MCQ/OB1.md | 12 | 5-20 ")).toEqual({ ok: true, value: ep(12, 4, 20, "MCQ/OB1.md") });
	});

	it("treats a single column as a one-character range", () => {
		expect(parseEndpoint("a.md|1|3")).toEqual({ ok: true, value: ep(1, 2, 3) });
	});

	it("accepts the empty range n-(n-1)", () => {
		expect(parseEndpoint("a.md|1|5-4")).toEqual({ ok: true, value: ep(1, 4, 4) });
	});

	it.each(["a.md|1", "|1|1-2", "a.md|x|1-2", "a.md|0|1-2", "a.md|1|0-2", "a.md|1|5-2", "a.md|1|a-b"])(
		"rejects %s",
		(raw) => expect(parseEndpoint(raw).ok).toBe(false),
	);

	it("round-trips through formatEndpoint", () => {
		const raw = "Notes/x.md|3|7-15";
		const p = parseEndpoint(raw);
		expect(p.ok && formatEndpoint(p.value)).toBe(raw);
	});
});

describe("readRange / writeRange", () => {
	const text = "first\nhello world\r\nlast";

	it("reads the columns of the given line", () => {
		expect(readRange(text, ep(2, 6, 11))).toEqual({ ok: true, value: "world" });
	});

	it("ignores a trailing \\r and rejects ranges past the line end", () => {
		expect(readRange(text, ep(2, 6, 12)).ok).toBe(false);
	});

	it("rejects missing lines", () => {
		expect(readRange(text, ep(9, 0, 1)).ok).toBe(false);
	});

	it("replaces the range and resizes the endpoint", () => {
		const w = writeRange(text, ep(2, 6, 11), "there, everyone");
		expect(w).toEqual({ ok: true, value: { text: "first\nhello there, everyone\r\nlast", endpoint: ep(2, 6, 21) } });
	});

	it("refuses values with line breaks", () => {
		expect(writeRange(text, ep(2, 6, 11), "a\nb").ok).toBe(false);
	});
});

describe("trackEdit", () => {
	const base = "abc KEY def\nnext";
	const key = ep(1, 4, 7); // "KEY"
	const value = (text: string, e: Endpoint) => {
		const r = readRange(text, e);
		return r.ok ? r.value : r.error;
	};

	it("shifts the range when text is inserted before it", () => {
		const t = "XXabc KEY def\nnext";
		expect(value(t, trackEdit(base, t, key))).toBe("KEY");
	});

	it("shifts the range down when a line is added above", () => {
		const t = "new line\nabc KEY def\nnext";
		const e = trackEdit(base, t, key);
		expect(e.line).toBe(2);
		expect(value(t, e)).toBe("KEY");
	});

	it("follows the range when one save adds a line above and edits inside it", () => {
		const t = "top\nabc KEYS def\nnext\nmore";
		const e = trackEdit(base, t, key);
		expect(e.line).toBe(2);
		expect(value(t, e)).toBe("KEYS");
	});

	it("leaves the range alone for edits after it", () => {
		const t = "abc KEY defghi\nnext";
		expect(trackEdit(base, t, key)).toEqual(key);
	});

	it("grows when typing inside the range", () => {
		const t = "abc KEYS1 def\nnext";
		expect(value(t, trackEdit(base, t, key))).toBe("KEYS1");
	});

	it("grows when typing at the end boundary", () => {
		const t = "abc KEY! def\nnext";
		expect(value(t, trackEdit(base, t, key))).toBe("KEY!");
	});

	it("grows when the typed text could also be read as landing after the range", () => {
		const t = "abc KEY KEY def\nnext"; // " KEY" after KEY, or "KEY " after the space
		expect(value(t, trackEdit(base, t, key))).toBe("KEY KEY");
	});

	it("shrinks when a deletion could also be read as outside the range", () => {
		// "KEY " followed by a space; one space deleted
		expect(value("abc KEY def", trackEdit("abc KEY  def", "abc KEY def", ep(1, 4, 8)))).toBe("KEY");
	});

	it("grows when typing at the start boundary", () => {
		const t = "abc >KEY def\nnext";
		expect(value(t, trackEdit(base, t, key))).toBe(">KEY");
	});

	it("shrinks when characters inside are deleted", () => {
		const t = "abc K def\nnext";
		expect(value(t, trackEdit(base, t, key))).toBe("K");
	});

	it("widens over an edit that straddles the start", () => {
		const t = "abcZZEY def\nnext"; // " K" replaced by "ZZ"
		expect(value(t, trackEdit(base, t, key))).toBe("ZZEY");
	});

	it("stops at the end of the line if a line break is typed inside", () => {
		const t = "abc KE\nY def\nnext";
		const e = trackEdit(base, t, key);
		expect(e.line).toBe(1);
		expect(value(t, e)).toBe("KE");
	});

	it("handles a range at the very start of a file that begins with an empty line", () => {
		const text = "\nabc";
		const t = "\n\nabc";
		expect(trackEdit(text, t, ep(1, 0, 0))).toEqual(ep(1, 0, 0));
	});
});
