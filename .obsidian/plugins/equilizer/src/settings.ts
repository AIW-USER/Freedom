import { App, PluginSettingTab, Setting } from "obsidian";
import { MIN_INTERVAL_MS, parseEndpoint } from "./core";
import type EquilizerPlugin from "./main";

/** One synced pair: the raw text of the two boxes, `path|line|start-end`. */
export interface Pair {
	a: string;
	b: string;
	/** How often this pair's files are re-read as a backup to save events; 0 = never. */
	intervalMs?: number;
}

export interface EquilizerSettings {
	pairs: Pair[];
	/** Saved so sync resumes when Obsidian restarts. */
	syncing: boolean;
	/** Check interval for pairs that don't set their own. */
	intervalMs: number;
}

export const DEFAULT_SETTINGS: EquilizerSettings = {
	pairs: [{ a: "", b: "" }],
	syncing: false,
	intervalMs: 1000,
};

interface Row {
	a: HTMLInputElement;
	b: HTMLInputElement;
	status: HTMLElement;
}

const PLACEHOLDER = "MCQ/OB1.md|12|5-20";

export class EquilizerSettingTab extends PluginSettingTab {
	private rows: Row[] = [];

	constructor(app: App, private plugin: EquilizerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const { settings, engine } = this.plugin;
		const syncing = engine.running;
		containerEl.empty();
		containerEl.addClass("equilizer-settings");

		const intro = containerEl.createEl("p", { cls: "setting-item-description" });
		intro.appendText("Write each box as ");
		intro.createEl("code", { text: "file path|line|start-end" });
		intro.appendText(", for example ");
		intro.createEl("code", { text: PLACEHOLDER });
		intro.appendText(
			". Lines and characters are counted from 1, and both ends are included. While synchronizing, an edit to either range is copied to the other one. Each pair is copied as soon as Obsidian saves either file; the check interval re-reads the pair's files as a backup (0 turns that off).",
		);

		new Setting(containerEl)
			.setName(syncing ? `Synchronizing ${engine.activeCount} pair(s)` : "Stopped")
			.setDesc(syncing ? "Stop synchronizing before you edit the pairs." : "Check the pairs, then start.")
			.addButton((b) =>
				syncing
					? b.setButtonText("Stop synchronize").setWarning().onClick(() => this.plugin.confirmStop())
					: b.setButtonText("Synchronize").setCta().onClick(() => void this.plugin.startSync()),
			);

		this.rows = [];
		settings.pairs.forEach((pair, i) => {
			const rowEl = containerEl.createDiv("equilizer-pair");
			const inputs = rowEl.createDiv("equilizer-pair-inputs");
			const box = (value: string) =>
				inputs.createEl("input", {
					type: "text",
					cls: "equilizer-box",
					value,
					attr: { placeholder: PLACEHOLDER, spellcheck: "false" },
				});
			const a = box(pair.a);
			inputs.createSpan({ cls: "equilizer-eq", text: "=" });
			const b = box(pair.b);
			const remove = inputs.createEl("button", { text: "✕", attr: { "aria-label": "Remove pair" } });

			const timing = rowEl.createDiv("equilizer-pair-interval");
			timing.createSpan({ text: "Check every " });
			const seconds = timing.createEl("input", {
				type: "number",
				cls: "equilizer-seconds",
				value: String((pair.intervalMs ?? settings.intervalMs) / 1000),
				attr: { min: "0", step: "0.25", "aria-label": "Check interval in seconds" },
			});
			timing.createSpan({ text: " s (0 = only when a file is saved)" });

			a.disabled = b.disabled = remove.disabled = seconds.disabled = syncing;
			seconds.addEventListener("change", () => {
				const s = Number(seconds.value);
				const ms = !Number.isFinite(s) || s <= 0 ? 0 : Math.max(MIN_INTERVAL_MS, Math.round(s * 1000));
				pair.intervalMs = ms;
				seconds.value = String(ms / 1000);
				this.plugin.requestSave();
			});
			a.addEventListener("input", () => {
				pair.a = a.value;
				engine.status[i] = undefined;
				this.plugin.requestSave();
				this.refreshStatus();
			});
			b.addEventListener("input", () => {
				pair.b = b.value;
				engine.status[i] = undefined;
				this.plugin.requestSave();
				this.refreshStatus();
			});
			remove.addEventListener("click", async () => {
				settings.pairs.splice(i, 1);
				await this.plugin.saveSettings();
				this.display();
			});

			this.rows.push({ a, b, status: rowEl.createDiv("equilizer-status") });
		});

		new Setting(containerEl).addButton((b) =>
			b
				.setButtonText("Add pair")
				.setDisabled(syncing)
				.onClick(async () => {
					settings.pairs.push({ a: "", b: "", intervalMs: settings.intervalMs });
					await this.plugin.saveSettings();
					this.display();
				}),
		);

		this.refreshStatus();
	}

	/** Show each pair's box text again after the engine moved an endpoint. */
	refreshRow(index: number): void {
		const row = this.rows[index];
		const pair = this.plugin.settings.pairs[index];
		if (!row || !pair) return;
		if (row.a.value !== pair.a) row.a.value = pair.a;
		if (row.b.value !== pair.b) row.b.value = pair.b;
	}

	refreshStatus(): void {
		const { settings, engine } = this.plugin;
		this.rows.forEach((row, i) => {
			const pair = settings.pairs[i];
			let status: { ok: boolean; message: string } | undefined;
			if (engine.running) {
				status = engine.status[i] ?? { ok: false, message: "Not synchronizing (empty pair)" };
			} else if (pair && (pair.a.trim() || pair.b.trim())) {
				const pa = parseEndpoint(pair.a);
				const pb = parseEndpoint(pair.b);
				status = !pa.ok
					? { ok: false, message: `Left box: ${pa.error}` }
					: !pb.ok
						? { ok: false, message: `Right box: ${pb.error}` }
						: (engine.status[i] ?? { ok: true, message: "Ready" });
			}
			row.status.setText(status?.message ?? "");
			row.status.toggleClass("is-error", status !== undefined && !status.ok);
			row.status.toggleClass("is-ok", status?.ok === true);
		});
	}
}
