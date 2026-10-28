import { debounce, FuzzySuggestModal, MarkdownRenderChild, normalizePath, Notice, TFile } from "obsidian";

import type McqSchedulerPlugin from "../main";
import {
	applyRelief,
	currentPeriod,
	evaluate,
	Evaluation,
	recurringProgress,
	reliefHint,
	sourceProgress,
} from "./bars";
import {
	addEvent,
	buckets,
	clearEvents,
	emptyHistory,
	HistoryState,
	lastChange,
	periodSum,
	record,
	totalSince,
	bucketStart,
	shift,
} from "./history";
import { BarSpec, HeatmapSpec, parseBar, parseHeatmap, Source, sourceKey } from "./parse";
import { BarEntry, Registry } from "./registry";
import { renderBar, renderError, renderHeatmap, renderStatusItem } from "./render";
import type { ProgressSettings } from "./settings";

/** A rendered block that knows how to redraw itself (clock tick, new history). */
class LiveBlock extends MarkdownRenderChild {
	constructor(
		el: HTMLElement,
		private live: Set<LiveBlock>,
		readonly redraw: () => void,
	) {
		super(el);
	}
	onload(): void {
		this.live.add(this);
	}
	onunload(): void {
		this.live.delete(this);
	}
}

/**
 * Progress bars and heat maps, absorbed from the Progress Keeper plugin.
 *
 * Bars are defined as text in `progress` code blocks. A bar's number is
 * either typed in the note (logged when the note changes, as before) or
 * supplied by the scheduler through `source:` — questions answered, minutes
 * spent, modules completed — which the plugin logs as it happens. Both land
 * in one history, kept in `progress.json` in the plugin folder, which the
 * heat maps and recurring bars read.
 */
export class ProgressKeeper {
	history: HistoryState = emptyHistory();
	registry: Registry;
	private live = new Set<LiveBlock>();
	private statusEls: HTMLElement[] = [];
	private saveSoon = debounce(() => void this.save(), 1000, true);
	private redrawSoon = debounce(() => this.redrawAll(), 300, true);

	constructor(private plugin: McqSchedulerPlugin) {
		this.registry = new Registry(plugin.app, () => ({
			window: this.settings.defaultWindow,
			digits: this.settings.defaultDigits,
		}));
	}

	get settings(): ProgressSettings {
		return this.plugin.settings.progress;
	}

	private get path(): string {
		const dir = this.plugin.manifest.dir ?? `${this.plugin.app.vault.configDir}/plugins/mcq-scheduler`;
		return normalizePath(`${dir}/progress.json`);
	}

	async load(): Promise<void> {
		const { adapter } = this.plugin.app.vault;
		try {
			if (await adapter.exists(this.path)) {
				this.history = JSON.parse(await adapter.read(this.path)) as HistoryState;
			}
		} catch (e) {
			new Notice(`Could not read the progress history: ${String(e)}`);
		}

		const plugin = this.plugin;
		plugin.registerMarkdownCodeBlockProcessor("progress", (source, el, ctx) => {
			const parsed = parseBar(source, this.settings.defaultWindow, this.settings.defaultDigits);
			if (!parsed.ok) return renderError(el, parsed.error);
			const bar = parsed.spec;
			const draw = () => {
				const clash = this.registry
					.find(bar.id)
					.filter((e) => e.path !== ctx.sourcePath || e.spec.title !== bar.title);
				const warning = clash.length
					? `Another bar also uses the id "${bar.id}" (${clash[0].path}). Give one of them an \`id:\` line.`
					: undefined;
				const now = Date.now();
				renderBar(el, this.effective(bar, now), this.evaluate(bar, now), warning);
			};
			draw();
			ctx.addChild(new LiveBlock(el, this.live, draw));
		});

		plugin.registerMarkdownCodeBlockProcessor("progress-heatmap", (source, el, ctx) => {
			const parsed = parseHeatmap(source);
			if (!parsed.ok) return renderError(el, parsed.error);
			const draw = () => this.drawHeatmap(el, parsed.spec);
			draw();
			ctx.addChild(new LiveBlock(el, this.live, draw));
		});

		plugin.addCommand({
			id: "choose-status-bars",
			name: "Choose status-bar progress bars",
			callback: () => new PinModal(this).open(),
		});
		plugin.addCommand({
			id: "rescan-progress-bars",
			name: "Rescan progress bars",
			callback: () => void this.rescan(),
		});

		// Colours follow the clock: a bar left alone drifts from ahead to behind.
		plugin.registerInterval(window.setInterval(() => this.redrawAll(), 60_000));

		plugin.app.workspace.onLayoutReady(async () => {
			await this.rescan();
			// On a cold start the metadata cache may still be filling, so notes
			// with code blocks can be missed by the first scan.
			const ref = plugin.app.metadataCache.on("resolved", () => {
				plugin.app.metadataCache.offref(ref);
				void this.rescan();
			});
			plugin.registerEvent(ref);
			plugin.registerEvent(
				plugin.app.metadataCache.on("changed", (file, data) => {
					if (!this.registry.has(file.path) && !/(```|~~~)progress\b/.test(data)) return;
					this.recordAll(this.registry.update(file.path, data));
				}),
			);
			plugin.registerEvent(
				plugin.app.vault.on("delete", (file) => {
					if (!this.registry.has(file.path)) return;
					this.registry.remove(file.path);
					this.refreshStatusBar();
				}),
			);
			plugin.registerEvent(
				plugin.app.vault.on("rename", async (file, oldPath) => {
					if (!(file instanceof TFile) || !this.registry.has(oldPath)) return;
					await this.registry.rename(file, oldPath);
					this.refreshStatusBar();
				}),
			);
		});
	}

	unload(): void {
		for (const el of this.statusEls) el.remove();
		this.statusEls = [];
	}

	async save(): Promise<void> {
		try {
			await this.plugin.app.vault.adapter.write(this.path, JSON.stringify(this.history));
		} catch (e) {
			new Notice(`Could not save the progress history: ${String(e)}`);
		}
	}

	async rescan(): Promise<void> {
		await this.registry.scan();
		this.recordAll(this.registry.all().map((e) => e.spec));
	}

	// ------------------------------------------------------------- sources

	/** Log scheduler activity: +1 question, +minutes, ±1 module completed. */
	addSource(source: Source, d: number): void {
		if (d === 0) return;
		addEvent(this.history, sourceKey(source), d, Date.now());
		this.saveSoon();
		this.redrawSoon();
	}

	clearSource(source: Source): void {
		clearEvents(this.history, sourceKey(source));
		this.saveSoon();
		this.redrawAll();
	}

	/** Total ever, and today (local midnight to now). */
	sourceTotals(source: Source): { total: number; today: number } {
		const key = sourceKey(source);
		const now = Date.now();
		const today = bucketStart(now, "day");
		return {
			total: totalSince(this.history.events, key),
			today: periodSum(this.history.events, key, today, shift(today, "day", 1)),
		};
	}

	// ---------------------------------------------------------------- bars

	/** Log any typed value changes, then redraw everything that depends on them. */
	private recordAll(bars: BarSpec[]): void {
		const now = Date.now();
		let changed = false;
		for (const bar of bars) {
			// A sourced bar's number is not typed; its history is logged as it happens.
			if (bar.source) continue;
			const before = this.history.last[bar.id];
			record(this.history, bar.id, bar.value, now, this.baseline(bar, now));
			if (this.history.last[bar.id] !== before) changed = true;
		}
		if (changed) {
			this.saveSoon();
			this.redrawAll();
		} else {
			this.refreshStatusBar();
		}
	}

	/** The bar as it applies now: with Sunday relief, a lower goal. */
	effective(bar: BarSpec, now: number): BarSpec {
		return applyRelief(bar, now, this.reliefPct()).bar;
	}

	private reliefPct(): number | null {
		return this.settings.sundayRelief ? this.settings.sundayReliefPercent : null;
	}

	/** Takes the bar as written; relief is applied here. */
	evaluate(written: BarSpec, now: number): Evaluation {
		const { bar, relief } = applyRelief(written, now, this.reliefPct());
		const ev = this.evaluateRaw(bar, now);
		if (!relief) return ev;
		const note = reliefHint(relief, bar.total);
		return { ...ev, hint: ev.hint ? `${note}. ${ev.hint}` : note };
	}

	private evaluateRaw(bar: BarSpec, now: number): Evaluation {
		if (bar.source) return evaluate(bar, now, sourceProgress(bar, this.history, now));
		if (bar.type !== "recurring") return evaluate(bar, now);
		const { done, hint } = recurringProgress(bar, this.history, now);
		return { ...evaluate(bar, now, done), hint };
	}

	/** A reset-count bar's first change in a new period counts from 0. */
	private baseline(bar: BarSpec, now: number): number | undefined {
		if (bar.type !== "recurring" || bar.count === "running") return undefined;
		const changed = lastChange(this.history, bar.id);
		return changed === undefined || changed < currentPeriod(bar, now).start ? 0 : undefined;
	}

	redrawAll(): void {
		for (const block of this.live) block.redraw();
		this.refreshStatusBar();
	}

	/** The history id a bar's events live under. */
	private historyId(bar: BarSpec): string {
		return bar.source ? sourceKey(bar.source) : bar.id;
	}

	private drawHeatmap(el: HTMLElement, spec: HeatmapSpec): void {
		const entries = this.registry.all();
		const wanted = spec.bars ? new Set(spec.bars) : null;
		const matched = entries.filter((e) => !wanted || wanted.has(e.spec.id) || wanted.has(e.spec.title));
		const weights = new Map<string, number>();
		for (const e of matched) {
			weights.set(this.historyId(e.spec), spec.measure === "percent" ? 100 / e.spec.total : 1);
		}
		// A named bar that's gone from the notes still has history worth showing.
		if (wanted && spec.measure === "value") for (const id of wanted) if (!weights.has(id)) weights.set(id, 1);

		const data = buckets(this.history.events, (id) => weights.get(id) ?? null, spec.unit, spec.cells, Date.now());
		const names = [...new Set(matched.map((e) => e.spec.title))];
		if (wanted) {
			for (const id of wanted) {
				if (!matched.some((e) => e.spec.id === id || e.spec.title === id)) names.push(`${id} (not found)`);
			}
		}
		renderHeatmap(el, spec, data, names);
	}

	firstEntry(id: string): BarEntry | undefined {
		return this.registry.find(id)[0];
	}

	refreshStatusBar(): void {
		for (const el of this.statusEls) el.remove();
		this.statusEls = [];
		const now = Date.now();
		for (const id of this.settings.statusBars) {
			const entry = this.firstEntry(id);
			if (!entry) continue;
			const el = this.plugin.addStatusBarItem();
			renderStatusItem(
				el,
				this.effective(entry.spec, now),
				this.evaluate(entry.spec, now),
				this.settings.statusShowTitle,
			);
			el.addEventListener("click", () => void this.plugin.app.workspace.openLinkText(entry.path, "", false));
			this.statusEls.push(el);
		}
	}

	async togglePinned(id: string): Promise<void> {
		const list = this.settings.statusBars;
		const i = list.indexOf(id);
		if (i >= 0) list.splice(i, 1);
		else list.push(id);
		await this.plugin.saveSettings();
		this.refreshStatusBar();
	}

	async movePinned(i: number, by: number): Promise<void> {
		const list = this.settings.statusBars;
		const [id] = list.splice(i, 1);
		list.splice(i + by, 0, id);
		await this.plugin.saveSettings();
		this.refreshStatusBar();
	}
}

class PinModal extends FuzzySuggestModal<BarEntry> {
	constructor(private pk: ProgressKeeper) {
		super(pk["plugin"].app);
		this.setPlaceholder("Toggle a bar in the status bar…");
	}
	getItems(): BarEntry[] {
		const seen = new Set<string>();
		return this.pk.registry.all().filter((e) => !seen.has(e.spec.id) && seen.add(e.spec.id));
	}
	getItemText(e: BarEntry): string {
		const pinned = this.pk.settings.statusBars.includes(e.spec.id);
		return `${pinned ? "✓ " : "   "}${e.spec.id}  —  ${e.path}`;
	}
	onChooseItem(e: BarEntry): void {
		void this.pk.togglePinned(e.spec.id);
	}
}
