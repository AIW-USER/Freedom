/**
 * Parsing for the two code blocks. Pure: no Obsidian runtime imports, so
 * vitest can run it directly.
 *
 * ```progress
 * Mastered: 120/2981
 * start: 2026:09:01:00:00
 * deadline: 2026:12:31:23:59
 * window: 5
 * id: mastered
 * ```
 *
 * ```progress
 * Questions answered: 30/100
 * type: recurring
 * every: 1 day
 * ```
 *
 * ```progress-heatmap
 * title: MCQ activity
 * bars: mastered, Questions answered
 * unit: day
 * cells: 90
 * measure: value
 * ```
 */

export type Unit = "hour" | "day" | "week" | "month";
export const UNITS: Unit[] = ["hour", "day", "week", "month"];

export interface Every {
	n: number;
	unit: Unit;
}

/**
 * `fixed`: one run from `start` to `deadline` (or no schedule at all).
 * `recurring`: `total` is the goal for each period of length `every`; the
 * periods line up from `start` if given, else from midnight / Monday / the 1st.
 */
export type BarType = "fixed" | "recurring";
export type CountMode = "reset" | "running";

const COUNT_MODES: Record<string, CountMode> = {
	reset: "reset",
	manual: "reset",
	period: "reset",
	running: "running",
	tally: "running",
	cumulative: "running",
	total: "running",
};

/**
 * Where a bar's number comes from when the MCQ scheduler supplies it, instead
 * of the number written in the note.
 */
export type Source = "mcq-solved" | "mcq-time" | "modules-completed";
export const SOURCES: Source[] = ["mcq-solved", "mcq-time", "modules-completed"];

/** The history id a source's events are logged under. */
export function sourceKey(source: Source): string {
	return `src:${source}`;
}

export interface BarSpec {
	id: string;
	title: string;
	value: number;
	total: number;
	type: BarType;
	/** Epoch ms, local time. Fixed: both or neither set. Recurring: `start` is the optional period anchor. */
	start?: number;
	deadline?: number;
	/** Recurring bars only. */
	every?: Every;
	/**
	 * Recurring bars only. `reset` (default): the note's number is this
	 * period's count — you set it back to 0 (or type the new count) each
	 * period. `running`: the number is a running tally and the bar shows how
	 * much it rose this period.
	 */
	count?: CountMode;
	/** On-track band, in percentage points either side of the expected value. */
	window: number;
	/** Minimum digits for value and total in the `(0050/0100)` fraction; 0 means no padding. */
	digits: number;
	/** Fed by the scheduler: the note's number is ignored. */
	source?: Source;
	/** Daily bars only: this bar's own Sunday relief in percent, overriding the setting. */
	sunday?: number;
}

export interface HeatmapSpec {
	title?: string;
	/** Bar ids, or null for every bar in the vault. */
	bars: string[] | null;
	unit: Unit;
	cells: number;
	measure: "value" | "percent";
}

export type Parsed<T> = { ok: true; spec: T } | { ok: false; error: string };

const NUM = String.raw`-?\d+(?:\.\d+)?`;
// Greedy title, so the *last* colon splits it: "Time spent (mins): 0/60".
const HEAD = new RegExp(String.raw`^(.*):\s*(${NUM})\s*/\s*(${NUM})\s*$`);
/** `Title: total` — only for bars with a `source:`, whose value is not typed. */
const HEAD_GOAL = new RegExp(String.raw`^(.*):\s*(${NUM})\s*$`);

/**
 * `yyyy:mm:dd:hh:mm`, with the time optional. `-`, `/`, space and `T` are
 * accepted as separators too, so `2026-12-31 23:59` also works. Local time.
 */
export function parseDate(raw: string): number | null {
	const m = raw.trim().match(/^(\d{4})[:\-/](\d{1,2})[:\-/](\d{1,2})(?:[:\sT](\d{1,2})(?::(\d{1,2}))?)?$/);
	if (!m) return null;
	const [y, mo, d, h = "0", mi = "0"] = m.slice(1);
	const date = new Date(+y, +mo - 1, +d, +h, +mi);
	// Reject rollovers such as month 13 or 31 September.
	if (date.getFullYear() !== +y || date.getMonth() !== +mo - 1 || date.getDate() !== +d) return null;
	if (+h > 23 || +mi > 59) return null;
	return date.getTime();
}

/** `key: value` lines after the head. Keys are case-insensitive. */
function keyValues(lines: string[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const line of lines) {
		const i = line.indexOf(":");
		if (i < 0) continue;
		out.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
	}
	return out;
}

function contentLines(source: string): string[] {
	return source
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("//"));
}

const TYPES: Record<string, BarType> = {
	fixed: "fixed",
	once: "fixed",
	"start-finish": "fixed",
	"start and finish": "fixed",
	deadline: "fixed",
	recurring: "recurring",
	recurrent: "recurring",
	repeat: "recurring",
	repeating: "recurring",
};

function parseType(raw: string): BarType | null {
	return TYPES[raw.trim().toLowerCase()] ?? null;
}

const UNIT_WORDS: Record<string, Unit> = {
	h: "hour", hr: "hour", hrs: "hour", hour: "hour", hours: "hour", hourly: "hour",
	d: "day", day: "day", days: "day", daily: "day",
	w: "week", wk: "week", wks: "week", week: "week", weeks: "week", weekly: "week",
	mo: "month", mon: "month", month: "month", months: "month", monthly: "month",
};

/** `1 day`, `2 weeks`, `12h`, `daily`, `fortnightly`, `every 3 days`. */
export function parseEvery(raw: string): Every | null {
	const text = raw.trim().toLowerCase().replace(/^every\s+/, "");
	if (text === "fortnightly") return { n: 2, unit: "week" };
	const m = text.match(/^(\d+)?\s*([a-z]+)$/);
	if (!m) return null;
	const unit = UNIT_WORDS[m[2]];
	const n = m[1] === undefined ? 1 : Number(m[1]);
	if (!unit || !(n >= 1)) return null;
	return { n, unit };
}

export function parseBar(source: string, defaultWindow: number, defaultDigits = 4): Parsed<BarSpec> {
	const lines = contentLines(source);
	const kv = keyValues(lines.slice(1));

	const sourceRaw = kv.get("source");
	let barSource: Source | undefined;
	if (sourceRaw !== undefined) {
		barSource = SOURCES.find((s) => s === sourceRaw.trim().toLowerCase());
		if (!barSource) return { ok: false, error: `Source must be one of ${SOURCES.join(", ")}, not "${sourceRaw}".` };
	}

	const head = lines[0]?.match(HEAD);
	const goal = barSource && !head ? lines[0]?.match(HEAD_GOAL) : null;
	if (!head && !goal) {
		return {
			ok: false,
			error: barSource
				? "First line must be `Title: total` (or `Title: value/total`), e.g. `Questions answered: 100`."
				: "First line must be `Title: value/total`, e.g. `Mastered: 120/2981`.",
		};
	}
	const title = (head ?? goal)![1].trim();
	// A sourced bar's typed value means nothing; its number comes from the log.
	const value = head && !barSource ? Number(head[2]) : 0;
	const total = Number(head ? head[3] : goal![2]);
	if (!title) return { ok: false, error: "The bar needs a title before the colon." };
	if (!(total > 0)) return { ok: false, error: "The total must be greater than 0." };

	const spec: BarSpec = { id: kv.get("id") || title, title, value, total, type: "fixed", window: defaultWindow, digits: defaultDigits };
	if (barSource) spec.source = barSource;

	const typeRaw = kv.get("type");
	const everyRaw = kv.get("every") ?? kv.get("repeat");
	if (typeRaw !== undefined) {
		const type = parseType(typeRaw);
		if (!type) return { ok: false, error: `Type must be \`fixed\` or \`recurring\`, not "${typeRaw}".` };
		spec.type = type;
	} else if (everyRaw !== undefined) {
		spec.type = "recurring";
	}

	const startRaw = kv.get("start");
	const deadlineRaw = kv.get("deadline") ?? kv.get("end");

	if (spec.type === "recurring") {
		if (deadlineRaw !== undefined) {
			return { ok: false, error: "Recurring bars don't take `deadline:`. Use `every:` for the period length, or `type: fixed`." };
		}
		const every = everyRaw === undefined ? { n: 1, unit: "day" as Unit } : parseEvery(everyRaw);
		if (!every) return { ok: false, error: `Can't read every "${everyRaw}". Use e.g. \`1 day\`, \`2 weeks\`, \`12 hours\`, \`monthly\`.` };
		spec.every = every;
		const countRaw = kv.get("count");
		spec.count = "reset";
		if (countRaw !== undefined) {
			const count = COUNT_MODES[countRaw.trim().toLowerCase()];
			if (!count) return { ok: false, error: `Count must be \`reset\` or \`running\`, not "${countRaw}".` };
			spec.count = count;
		}
		if (startRaw !== undefined) {
			const start = parseDate(startRaw);
			if (start === null) return { ok: false, error: `Can't read start date "${startRaw}". Use yyyy:mm:dd:hh:mm.` };
			spec.start = start;
		}
	} else if (everyRaw !== undefined) {
		return { ok: false, error: "`every:` is only for recurring bars. Remove it or use `type: recurring`." };
	} else if (kv.has("count")) {
		return { ok: false, error: "`count:` is only for recurring bars. Remove it or use `type: recurring`." };
	} else if (startRaw !== undefined || deadlineRaw !== undefined) {
		if (startRaw === undefined || deadlineRaw === undefined) {
			return { ok: false, error: "A schedule needs both `start:` and `deadline:`." };
		}
		const start = parseDate(startRaw);
		const deadline = parseDate(deadlineRaw);
		if (start === null) return { ok: false, error: `Can't read start date "${startRaw}". Use yyyy:mm:dd:hh:mm.` };
		if (deadline === null) return { ok: false, error: `Can't read deadline "${deadlineRaw}". Use yyyy:mm:dd:hh:mm.` };
		if (deadline <= start) return { ok: false, error: "The deadline must be after the start." };
		spec.start = start;
		spec.deadline = deadline;
	}

	const sundayRaw = kv.get("sunday");
	if (sundayRaw !== undefined) {
		const daily = spec.type === "recurring" && spec.every?.n === 1 && spec.every.unit === "day";
		if (!daily) return { ok: false, error: "`sunday:` relief is only for daily bars (`every: 1 day`)." };
		const pct = Number(sundayRaw.replace(/%$/, "").trim());
		if (!(pct >= 0 && pct <= 100)) {
			return { ok: false, error: `Sunday relief must be a percentage from 0 to 100, not "${sundayRaw}".` };
		}
		spec.sunday = pct;
	}

	const digitsRaw = kv.get("digits");
	if (digitsRaw !== undefined) {
		const n = Number(digitsRaw);
		if (!Number.isInteger(n) || n < 0 || n > 10) return { ok: false, error: `Digits must be a whole number from 0 to 10, not "${digitsRaw}".` };
		spec.digits = n;
	}

	const windowRaw = kv.get("window");
	if (windowRaw !== undefined) {
		const w = Number(windowRaw.replace(/%$/, "").trim());
		if (!(w >= 0)) return { ok: false, error: `Can't read window "${windowRaw}". Use a number such as 5.` };
		spec.window = w;
	}
	return { ok: true, spec };
}

export function parseHeatmap(source: string): Parsed<HeatmapSpec> {
	const kv = keyValues(contentLines(source));
	const spec: HeatmapSpec = { bars: null, unit: "day", cells: 90, measure: "value" };

	const title = kv.get("title");
	if (title) spec.title = title;

	const bars = kv.get("bars") ?? kv.get("bar");
	if (bars && bars.toLowerCase() !== "all") {
		spec.bars = bars.split(",").map((b) => b.trim()).filter(Boolean);
	}

	const unit = kv.get("unit")?.toLowerCase().replace(/s$/, "");
	if (unit !== undefined) {
		if (!(UNITS as string[]).includes(unit)) return { ok: false, error: `Unit must be one of ${UNITS.join(", ")}.` };
		spec.unit = unit as Unit;
	}

	const cells = kv.get("cells") ?? kv.get("boxes");
	if (cells !== undefined) {
		const n = Number(cells);
		if (!Number.isInteger(n) || n < 1 || n > 2000) return { ok: false, error: "Cells must be a whole number from 1 to 2000." };
		spec.cells = n;
	}

	const measure = kv.get("measure")?.toLowerCase();
	if (measure !== undefined) {
		if (measure !== "value" && measure !== "percent") return { ok: false, error: "Measure must be `value` or `percent`." };
		spec.measure = measure;
	}
	return { ok: true, spec };
}

const BLOCK = /^[ \t]*(```|~~~)progress[ \t]*\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;

/** A fence of four or more backticks, which shows ```progress examples rather than rendering them. */
const OUTER_FENCE = /^[ \t]*(`{4,}|~{4,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;

/**
 * Every well-formed ```progress bar in a note's text, in order. Blocks shown
 * as examples inside a longer fence (as in the Progress bars help note) are
 * not bars and are skipped.
 */
export function extractBars(text: string, defaultWindow: number, defaultDigits = 4): BarSpec[] {
	const out: BarSpec[] = [];
	for (const m of text.replace(OUTER_FENCE, "").matchAll(BLOCK)) {
		const parsed = parseBar(m[2], defaultWindow, defaultDigits);
		if (parsed.ok) out.push(parsed.spec);
	}
	return out;
}
