import { debounce, FuzzySuggestModal, MarkdownRenderChild, Plugin, TFile } from "obsidian";

import { buckets, emptyHistory, HistoryState, lastChange, record } from "./history";
import { BarSpec, HeatmapSpec, parseBar, parseHeatmap } from "./parse";
import { BarEntry, Registry } from "./registry";
import { renderBar, renderError, renderHeatmap, renderStatusItem } from "./render";
import { currentPeriod, evaluate, Evaluation, recurringProgress } from "./schedule";
import { DEFAULT_SETTINGS, PkSettings, PkSettingTab } from "./settings";

interface StoredData {
	settings?: Partial<PkSettings>;
	history?: HistoryState;
}

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
 * Bars are defined and updated as text in notes; the plugin never writes to a
 * note. It keeps its own record of each bar's last value and every change
 * (data.json), which is what the heat maps draw from.
 */
export default class ProgressKeeperPlugin extends Plugin {
	declare settings: PkSettings;
	history: HistoryState = emptyHistory();
	registry!: Registry;
	private live = new Set<LiveBlock>();
	private statusEls: HTMLElement[] = [];
	private saveSoon = debounce(() => void this.saveAll(), 1000, true);

	async onload(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as StoredData;
		this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
		this.history = data.history ?? emptyHistory();
		this.registry = new Registry(this.app, () => ({ window: this.settings.defaultWindow, digits: this.settings.defaultDigits }));

		this.registerMarkdownCodeBlockProcessor("progress", (source, el, ctx) => {
			const parsed = parseBar(source, this.settings.defaultWindow, this.settings.defaultDigits);
			if (!parsed.ok) return renderError(el, parsed.error);
			const bar = parsed.spec;
			const draw = () => {
				const clash = this.registry.find(bar.id).filter((e) => e.path !== ctx.sourcePath || e.spec.title !== bar.title);
				const warning = clash.length
					? `Another bar also uses the id "${bar.id}" (${clash[0].path}). Give one of them an \`id:\` line.`
					: undefined;
				renderBar(el, bar, this.evaluate(bar, Date.now()), warning);
			};
			draw();
			ctx.addChild(new LiveBlock(el, this.live, draw));
		});

		this.registerMarkdownCodeBlockProcessor("progress-heatmap", (source, el, ctx) => {
			const parsed = parseHeatmap(source);
			if (!parsed.ok) return renderError(el, parsed.error);
			const draw = () => this.drawHeatmap(el, parsed.spec);
			draw();
			ctx.addChild(new LiveBlock(el, this.live, draw));
		});

		this.addSettingTab(new PkSettingTab(this.app, this));
		this.addCommand({
			id: "choose-status-bars",
			name: "Choose status-bar progress bars",
			callback: () => new PinModal(this).open(),
		});
		this.addCommand({
			id: "rescan",
			name: "Rescan progress bars",
			callback: () => void this.rescan(),
		});

		// Colours follow the clock: a bar left alone drifts from ahead to behind.
		this.registerInterval(window.setInterval(() => this.redrawAll(), 60_000));

		this.app.workspace.onLayoutReady(async () => {
			await this.rescan();
			// On a cold start the metadata cache may still be filling, so notes
			// with code blocks can be missed by the first scan. Scan once more
			// when it settles.
			const ref = this.app.metadataCache.on("resolved", () => {
				this.app.metadataCache.offref(ref);
				void this.rescan();
			});
			this.registerEvent(ref);
			this.registerEvent(
				this.app.metadataCache.on("changed", (file, data) => {
					if (!this.registry.has(file.path) && !/(```|~~~)progress\b/.test(data)) return;
					this.recordAll(this.registry.update(file.path, data));
				}),
			);
			this.registerEvent(
				this.app.vault.on("delete", (file) => {
					if (!this.registry.has(file.path)) return;
					this.registry.remove(file.path);
					this.refreshStatusBar();
				}),
			);
			this.registerEvent(
				this.app.vault.on("rename", async (file, oldPath) => {
					if (!(file instanceof TFile) || !this.registry.has(oldPath)) return;
					await this.registry.rename(file, oldPath);
					this.refreshStatusBar();
				}),
			);
		});
	}

	onunload(): void {
		for (const el of this.statusEls) el.remove();
	}

	async saveAll(): Promise<void> {
		await this.saveData({ settings: this.settings, history: this.history } satisfies StoredData);
	}

	async rescan(): Promise<void> {
		await this.registry.scan();
		this.recordAll(this.registry.all().map((e) => e.spec));
	}

	/** Log any value changes, then redraw everything that depends on them. */
	private recordAll(bars: BarSpec[]): void {
		const now = Date.now();
		let changed = false;
		for (const bar of bars) {
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

	/**
	 * A recurring bar's progress is what was added this period, read from the
	 * change log — the note's number is a running tally (or reset to 0 by hand).
	 */
	evaluate(bar: BarSpec, now: number): Evaluation {
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

	private drawHeatmap(el: HTMLElement, spec: HeatmapSpec): void {
		const entries = this.registry.all();
		const wanted = spec.bars ? new Set(spec.bars) : null;
		const matched = entries.filter((e) => !wanted || wanted.has(e.spec.id) || wanted.has(e.spec.title));
		const weights = new Map<string, number>();
		for (const e of matched) weights.set(e.spec.id, spec.measure === "percent" ? 100 / e.spec.total : 1);
		// A named bar that's gone from the notes still has history worth showing.
		if (wanted && spec.measure === "value") for (const id of wanted) if (!weights.has(id)) weights.set(id, 1);

		const data = buckets(this.history.events, (id) => weights.get(id) ?? null, spec.unit, spec.cells, Date.now());
		const names = [...new Set(matched.map((e) => e.spec.title))];
		if (wanted) for (const id of wanted) if (!matched.some((e) => e.spec.id === id || e.spec.title === id)) names.push(`${id} (not found)`);
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
			const el = this.addStatusBarItem();
			renderStatusItem(el, entry.spec, this.evaluate(entry.spec, now), this.settings.statusShowTitle);
			el.addEventListener("click", () => void this.app.workspace.openLinkText(entry.path, "", false));
			this.statusEls.push(el);
		}
	}

	async togglePinned(id: string): Promise<void> {
		const list = this.settings.statusBars;
		const i = list.indexOf(id);
		if (i >= 0) list.splice(i, 1);
		else list.push(id);
		await this.saveAll();
		this.refreshStatusBar();
	}
}

class PinModal extends FuzzySuggestModal<BarEntry> {
	constructor(private plugin: ProgressKeeperPlugin) {
		super(plugin.app);
		this.setPlaceholder("Toggle a bar in the status bar…");
	}
	getItems(): BarEntry[] {
		const seen = new Set<string>();
		return this.plugin.registry.all().filter((e) => !seen.has(e.spec.id) && seen.add(e.spec.id));
	}
	getItemText(e: BarEntry): string {
		const pinned = this.plugin.settings.statusBars.includes(e.spec.id);
		return `${pinned ? "✓ " : "   "}${e.spec.id}  —  ${e.path}`;
	}
	onChooseItem(e: BarEntry): void {
		void this.plugin.togglePinned(e.spec.id);
	}
}
