import { setTooltip } from "obsidian";

import { Bucket, level } from "./history";
import type { BarSpec, HeatmapSpec } from "./parse";
import { describe, Evaluation, formatEvery, formatNumber, formatPadded } from "./bars";

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function statusClass(ev: Evaluation): string {
	return `pk-${ev.status}`;
}

/** `0050/0100`, padded to the bar's `digits`. */
function fraction(bar: BarSpec, ev: Evaluation): string {
	return `${formatPadded(+ev.value.toFixed(2), bar.digits)}/${formatPadded(bar.total, bar.digits)}`;
}

/** The full bar shown in a note. */
export function renderBar(el: HTMLElement, bar: BarSpec, ev: Evaluation, warning?: string): void {
	el.empty();
	const root = el.createDiv({ cls: ["pk-bar", statusClass(ev), `pk-type-${bar.type}`] });

	const head = root.createDiv({ cls: "pk-head" });
	const titleEl = head.createSpan({ cls: "pk-title", text: bar.title });
	if (bar.every) titleEl.createSpan({ cls: "pk-badge", text: formatEvery(bar.every) });
	const nums = head.createSpan({ cls: "pk-nums" });
	nums.createSpan({ cls: "pk-percent", text: `${Math.floor(ev.percent)}%` });
	nums.createSpan({ cls: "pk-fraction", text: ` (${fraction(bar, ev)})` });

	const track = root.createDiv({ cls: "pk-track" });
	track.createDiv({ cls: "pk-fill" }).style.width = `${Math.min(100, Math.max(0, ev.percent))}%`;
	for (const q of [25, 50, 75]) track.createDiv({ cls: "pk-tick" }).style.left = `${q}%`;
	if (ev.expectedPercent !== undefined) {
		const marker = track.createDiv({ cls: "pk-expected" });
		marker.style.left = `${ev.expectedPercent}%`;
		setTooltip(marker, `Expected now: ${formatNumber(+(ev.expected ?? 0).toFixed(1))}`);
	}

	const range = ev.period ?? (bar.start !== undefined && bar.deadline !== undefined ? { start: bar.start, end: bar.deadline } : null);
	if (range) {
		const foot = root.createDiv({ cls: "pk-foot" });
		foot.createSpan({ cls: "pk-schedule", text: describe(bar, ev) });
		foot.createSpan({ cls: "pk-dates", text: `${dateTimeFmt.format(range.start)} → ${dateTimeFmt.format(range.end)}` });
	}
	if (ev.hint) root.createDiv({ cls: "pk-hint", text: ev.hint });
	if (warning) root.createDiv({ cls: "pk-warning", text: warning });
}

/** The compact form used in the status bar. */
export function renderStatusItem(el: HTMLElement, bar: BarSpec, ev: Evaluation, showTitle: boolean): void {
	el.empty();
	el.removeClasses(["pk-ahead", "pk-behind", "pk-on-track", "pk-none"]);
	el.addClasses(["pk-status", statusClass(ev)]);
	if (showTitle) el.createSpan({ cls: "pk-status-title", text: bar.title });
	const track = el.createDiv({ cls: "pk-status-track" });
	track.createDiv({ cls: "pk-fill" }).style.width = `${Math.min(100, Math.max(0, ev.percent))}%`;
	if (ev.expectedPercent !== undefined) track.createDiv({ cls: "pk-expected" }).style.left = `${ev.expectedPercent}%`;
	el.createSpan({ cls: "pk-status-percent", text: `${Math.floor(ev.percent)}%` });

	const lines = [`${bar.title}: ${fraction(bar, ev)}${bar.every ? ` (${formatEvery(bar.every).toLowerCase()})` : ""}`];
	const summary = describe(bar, ev);
	if (summary) lines.push(summary);
	if (ev.hint) lines.push(ev.hint);
	setTooltip(el, lines.join("\n"), { placement: "top" });
}

export function renderError(el: HTMLElement, message: string): void {
	el.empty();
	el.createDiv({ cls: "pk-error", text: `Progress Keeper: ${message}` });
}

function bucketLabel(start: number, unit: HeatmapSpec["unit"]): string {
	const d = new Date(start);
	switch (unit) {
		case "hour":
			return dateTimeFmt.format(d);
		case "day":
			return dateFmt.format(d);
		case "week":
			return `Week of ${dateFmt.format(d)}`;
		case "month":
			return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
	}
}

/**
 * Days lay out GitHub-style: one column per week, Monday at the top. Hours get
 * a row per day, months a row per year, weeks simply wrap. Leading blank cells
 * keep those rows aligned to the calendar.
 */
function layout(unit: HeatmapSpec["unit"], first: number, count: number): { columns?: number; rows?: number; pad: number } {
	const d = new Date(first);
	switch (unit) {
		case "day":
			return { rows: 7, pad: (d.getDay() + 6) % 7 };
		case "hour":
			return { columns: 24, pad: d.getHours() };
		case "month":
			return { columns: 12, pad: d.getMonth() };
		case "week":
			return { columns: Math.min(count, 26), pad: 0 };
	}
}

export function renderHeatmap(el: HTMLElement, spec: HeatmapSpec, data: Bucket[], barNames: string[]): void {
	el.empty();
	const root = el.createDiv({ cls: "pk-heatmap" });
	const head = root.createDiv({ cls: "pk-head" });
	head.createSpan({ cls: "pk-title", text: spec.title ?? "Activity" });
	const total = data.reduce((s, b) => s + b.amount, 0);
	head.createSpan({
		cls: "pk-nums",
		text: `${formatNumber(+total.toFixed(1))}${spec.measure === "percent" ? "%" : ""} in ${data.length} ${spec.unit}${data.length === 1 ? "" : "s"}`,
	});

	const scroller = root.createDiv({ cls: "pk-grid-scroll" });
	const grid = scroller.createDiv({ cls: `pk-grid pk-grid-${spec.unit}` });
	const { columns, rows, pad } = layout(spec.unit, data[0].start, data.length);
	if (rows) grid.style.gridTemplateRows = `repeat(${rows}, var(--pk-cell))`;
	if (columns) grid.style.gridTemplateColumns = `repeat(${columns}, var(--pk-cell))`;
	for (let i = 0; i < pad; i++) grid.createDiv({ cls: "pk-cell pk-cell-pad" });

	const max = Math.max(0, ...data.map((b) => b.amount));
	const unitSuffix = spec.measure === "percent" ? "%" : "";
	for (const b of data) {
		const cell = grid.createDiv({ cls: `pk-cell pk-level-${level(b.amount, max)}` });
		setTooltip(cell, `${bucketLabel(b.start, spec.unit)}: +${formatNumber(+b.amount.toFixed(2))}${unitSuffix}`);
	}

	const foot = root.createDiv({ cls: "pk-foot" });
	foot.createSpan({ cls: "pk-dates", text: barNames.length ? barNames.join(", ") : "No bars matched" });
	const legend = foot.createSpan({ cls: "pk-legend" });
	legend.createSpan({ text: "Less" });
	for (let l = 0; l <= 4; l++) legend.createSpan({ cls: `pk-cell pk-level-${l}` });
	legend.createSpan({ text: "More" });
}
