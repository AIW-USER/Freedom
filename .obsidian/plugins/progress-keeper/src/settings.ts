import { App, PluginSettingTab, Setting } from "obsidian";

import type ProgressKeeperPlugin from "./main";

export interface PkSettings {
	/** Default on-track band (percentage points) for bars without `window:`. */
	defaultWindow: number;
	/** Default minimum digits in a bar's fraction, e.g. 4 → `0050/0100`. */
	defaultDigits: number;
	/** Bar ids pinned to the status bar, left to right. */
	statusBars: string[];
	statusShowTitle: boolean;
}

export const DEFAULT_SETTINGS: PkSettings = {
	defaultWindow: 5,
	defaultDigits: 4,
	statusBars: [],
	statusShowTitle: true,
};

export class PkSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: ProgressKeeperPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default on-track window")
			.setDesc("Percentage points either side of the expected progress that still count as on track (blue). A bar's own `window:` line overrides it.")
			.addText((t) =>
				t.setValue(String(settings.defaultWindow)).onChange(async (v) => {
					const n = Number(v);
					if (!(n >= 0)) return;
					settings.defaultWindow = n;
					await this.plugin.saveAll();
					await this.plugin.rescan();
				}),
			);

		new Setting(containerEl)
			.setName("Default digits")
			.setDesc("Numbers in a bar's fraction are padded with leading zeros to at least this many digits: 4 shows 0050/0100. 0 turns padding off. A bar's own `digits:` line overrides it.")
			.addText((t) =>
				t.setValue(String(settings.defaultDigits)).onChange(async (v) => {
					const n = Number(v);
					if (!Number.isInteger(n) || n < 0 || n > 10) return;
					settings.defaultDigits = n;
					await this.plugin.saveAll();
					await this.plugin.rescan();
					this.plugin.redrawAll();
				}),
			);

		new Setting(containerEl)
			.setName("Show titles in the status bar")
			.addToggle((t) =>
				t.setValue(settings.statusShowTitle).onChange(async (v) => {
					settings.statusShowTitle = v;
					await this.plugin.saveAll();
					this.plugin.refreshStatusBar();
				}),
			);

		new Setting(containerEl).setName("Status bar").setHeading().setDesc("Pinned bars appear left of backlinks and word count, in this order.");

		const ids = new Set(this.plugin.registry.all().map((e) => e.spec.id));
		// Pinned first (in order, including ones not currently found), then the rest.
		const rows = [...settings.statusBars, ...[...ids].filter((id) => !settings.statusBars.includes(id))];
		if (!rows.length) containerEl.createEl("p", { cls: "setting-item-description", text: "No ```progress bars found in the vault yet." });

		for (const id of rows) {
			const pinned = settings.statusBars.indexOf(id);
			const entries = this.plugin.registry.find(id);
			const desc = entries.length ? entries.map((e) => e.path).join(", ") : "Not found in any note";
			const s = new Setting(containerEl).setName(id).setDesc(desc);
			if (pinned >= 0) {
				s.addExtraButton((b) =>
					b
						.setIcon("arrow-up")
						.setTooltip("Move left")
						.setDisabled(pinned === 0)
						.onClick(() => void this.move(pinned, -1)),
				);
				s.addExtraButton((b) =>
					b
						.setIcon("arrow-down")
						.setTooltip("Move right")
						.setDisabled(pinned === settings.statusBars.length - 1)
						.onClick(() => void this.move(pinned, 1)),
				);
			}
			s.addToggle((t) =>
				t.setValue(pinned >= 0).onChange(async () => {
					await this.plugin.togglePinned(id);
					this.display();
				}),
			);
		}
	}

	private async move(i: number, by: number): Promise<void> {
		const list = this.plugin.settings.statusBars;
		const [id] = list.splice(i, 1);
		list.splice(i + by, 0, id);
		await this.plugin.saveAll();
		this.plugin.refreshStatusBar();
		this.display();
	}
}
