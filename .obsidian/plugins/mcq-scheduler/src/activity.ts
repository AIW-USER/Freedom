/**
 * The MCQ activity note: a template of progress bars and heat maps, written
 * once when you press "Start activity log" and never again, so goals, dates
 * and layout are yours to edit. The numbers come from the scheduler through
 * each bar's `source:` line (see src/progress/).
 *
 * Pure — no Obsidian import.
 */

/**
 * Most time one question can add to the log. Leaving the pane open on a
 * question over lunch should not log an hour of study.
 */
export const QUESTION_TIME_CAP_MS = 15 * 60_000;

/** Four digits, zero-padded: 93 → `0093`. Past 9999 it simply grows. */
export function pad4(n: number): string {
	return String(Math.max(0, Math.floor(n))).padStart(4, "0");
}

/** Whole minutes, floored. */
export function minutes(ms: number): number {
	return Math.floor(Math.max(0, ms) / 60_000);
}

const FENCE = "```";

function block(kind: "progress" | "progress-heatmap", lines: string[]): string {
	return [`${FENCE}${kind}`, ...lines, FENCE].join("\n");
}

/** The note written by "Start activity log". `modules` is the module count for the goal. */
export function activityTemplate(modules: number): string {
	return [
		"# MCQ activity",
		"",
		"Progress bars fed by the MCQ scheduler. Edit any goal, date or layout here — the plugin",
		"wrote this note once and never rewrites it. See [[Progress bars]] for every option.",
		"",
		"## Today",
		"",
		block("progress", ["Questions answered: 100", "source: mcq-solved", "every: 1 day", "id: daily-questions"]),
		"",
		block("progress", ["Time spent (mins): 60", "source: mcq-time", "every: 1 day", "id: daily-time"]),
		"",
		"## Modules",
		"",
		block("progress", [
			`Modules completed: ${modules}`,
			"source: modules-completed",
			"start: 2026:09:01:00:00",
			"deadline: 2026:12:31:23:59",
			"id: modules-completed",
		]),
		"",
		"## Overall",
		"",
		block("progress", ["Progress: 045/100", "start: 2026:09:01:00:00", "deadline: 2027:06:30:23:59", "id: overall"]),
		"",
		"## Totals",
		"",
		block("progress", ["MCQs solved: 12528", "source: mcq-solved", "id: mcqs-solved"]),
		"",
		block("progress", ["Time spent, total (mins): 6000", "source: mcq-time", "id: minutes-total"]),
		"",
		"## Activity",
		"",
		block("progress-heatmap", ["title: MCQs, daily", "bars: daily-questions", "unit: day", "cells: 120"]),
		"",
		block("progress-heatmap", ["title: Minutes, daily", "bars: daily-time", "unit: day", "cells: 120"]),
		"",
		block("progress-heatmap", ["title: Modules completed, weekly", "bars: modules-completed", "unit: week", "cells: 26"]),
		"",
	].join("\n");
}
