import { Notice, Plugin, debounce } from "obsidian";
import { ConfirmModal } from "./confirm";
import { DEFAULT_SETTINGS, EquilizerSettingTab, EquilizerSettings, Pair } from "./settings";
import { SyncEngine, SyncHost } from "./sync";

export default class EquilizerPlugin extends Plugin implements SyncHost {
	// `Plugin.settings` exists as `unknown` since 1.13.0; `declare` narrows it.
	declare settings: EquilizerSettings;
	engine!: SyncEngine;
	private tab!: EquilizerSettingTab;
	private statusEl!: HTMLElement;

	requestSave = debounce(() => void this.saveSettings(), 500, true);

	get pairs(): Pair[] {
		return this.settings.pairs;
	}

	get defaultIntervalMs(): number {
		return this.settings.intervalMs;
	}

	async onload(): Promise<void> {
		await this.loadSettings();
		this.engine = new SyncEngine(this.app, this);
		this.tab = new EquilizerSettingTab(this.app, this);
		this.addSettingTab(this.tab);

		this.statusEl = this.addStatusBarItem();
		this.statusEl.addClass("mod-clickable");
		this.statusEl.addEventListener("click", () => (this.engine.running ? this.confirmStop() : void this.startSync()));
		this.updateStatusBar();

		this.addCommand({ id: "synchronize", name: "Synchronize", callback: () => void this.startSync() });
		this.addCommand({
			id: "stop-synchronize",
			name: "Stop synchronize",
			checkCallback: (checking) => {
				if (!this.engine.running) return false;
				if (!checking) this.confirmStop();
				return true;
			},
		});

		// Resume after a restart; settings.syncing is left as is on unload.
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.syncing) void this.startSync(true);
		});
	}

	onunload(): void {
		this.engine.stop();
	}

	async startSync(quiet = false): Promise<void> {
		if (!this.settings.pairs.some((p) => p.a.trim() || p.b.trim())) {
			new Notice("Equilizer: add a pair in settings first.");
			return;
		}
		const active = await this.engine.start();
		const failed = this.engine.status.filter((s) => s && !s.ok).length;
		this.settings.syncing = active > 0;
		await this.saveSettings();
		if (active === 0) {
			new Notice("Equilizer: no pair could be synchronized. See the settings tab for details.");
		} else if (!quiet || failed > 0) {
			new Notice(`Equilizer: synchronizing ${active} pair(s)${failed ? `, ${failed} with errors (see settings)` : ""}.`);
		}
		this.refreshUi();
	}

	confirmStop(): void {
		new ConfirmModal(
			this.app,
			"Stop synchronizing?",
			"Are you sure you want to stop synchronizing? Edits will no longer be copied between the paired files.",
			"Stop synchronize",
			() => void this.stopSync(),
		).open();
	}

	async stopSync(): Promise<void> {
		this.engine.stop();
		this.engine.status = [];
		this.settings.syncing = false;
		await this.saveSettings();
		new Notice("Equilizer: stopped synchronizing.");
		this.refreshUi();
	}

	onEndpointsMoved(index: number, a: string, b: string): void {
		const pair = this.settings.pairs[index];
		if (!pair || (pair.a === a && pair.b === b)) return;
		pair.a = a;
		pair.b = b;
		this.requestSave();
		this.tab.refreshRow(index);
	}

	onStatus(): void {
		this.tab.refreshStatus();
		this.updateStatusBar();
	}

	private refreshUi(): void {
		// Re-render only if the tab is on screen; display() rebuilds it next time it opens.
		if (this.tab.containerEl.isConnected) this.tab.display();
		this.updateStatusBar();
	}

	private updateStatusBar(): void {
		const running = this.engine.running;
		this.statusEl.setText(running ? `⇄ Equilizer: ${this.engine.activeCount} pair(s)` : "Equilizer: stopped");
		this.statusEl.setAttr("aria-label", running ? "Click to stop synchronizing" : "Click to synchronize");
		this.statusEl.toggleClass("equilizer-running", running);
		this.statusEl.toggleClass("equilizer-error", this.engine.status.some((s) => s && !s.ok));
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<EquilizerSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...data, pairs: data?.pairs ?? DEFAULT_SETTINGS.pairs.map((p) => ({ ...p })) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
