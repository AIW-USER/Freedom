import { normalizePath, Notice, TFile } from "obsidian";

import type McqSchedulerPlugin from "./main";
import { ModuleDef, parseModules } from "./modules";
import { completedCount, migrate, ScheduleState } from "./schedule";

/**
 * Loads and saves the module schedule, and keeps the parsed modules file.
 *
 * Both files live in the plugin folder, not the vault, so the plugin still
 * writes no notes:
 * - `schedule.json` — the whole {@link ScheduleState}, rewritten after every
 *   answer so the question on screen survives a restart;
 * - `responses.jsonl` — one line per answer, appended, never rewritten.
 */
export class ScheduleStore {
	state: ScheduleState | null = null;
	defs: ModuleDef[] = [];
	byKey = new Map<string, ModuleDef>();
	private listeners = new Set<() => void>();
	/** The modules file the last reload read; undefined before the first. */
	private scope: string | undefined;
	private writing: Promise<void> = Promise.resolve();

	constructor(private plugin: McqSchedulerPlugin) {}

	private get dir(): string {
		return this.plugin.manifest.dir ?? `${this.plugin.app.vault.configDir}/plugins/mcq-scheduler`;
	}

	private get statePath(): string {
		return normalizePath(`${this.dir}/schedule.json`);
	}

	private get logPath(): string {
		return normalizePath(`${this.dir}/responses.jsonl`);
	}

	get modulesPath(): string {
		return normalizePath(this.plugin.settings.modulesFile);
	}

	async load(): Promise<void> {
		const { adapter } = this.plugin.app.vault;
		try {
			if (await adapter.exists(this.statePath)) {
				// An older, session-based schedule is converted in place; it is
				// written back in the new shape on the next change.
				this.state = migrate(JSON.parse(await adapter.read(this.statePath)));
			}
		} catch (e) {
			new Notice(`Could not read the module schedule: ${String(e)}`);
		}
	}

	/** Re-read the modules file. Cheap: one small note. */
	async reloadModules(): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(this.modulesPath);
		const completedBefore = this.completed();
		this.defs = file instanceof TFile ? parseModules(await this.plugin.app.vault.cachedRead(file)) : [];
		this.byKey = new Map(this.defs.map((d) => [d.key, d]));
		// Activity is kept per modules file. Editing the file moves its
		// `modules-completed` count by the difference; a file shown for the
		// first time starts from what its modules already have completed.
		const pk = this.plugin.progress;
		if (this.plugin.activity.enabled) {
			if (this.scope === this.modulesPath) pk.addSource("modules-completed", this.completed() - completedBefore);
			else if (!pk.hasSource("modules-completed")) pk.addSource("modules-completed", this.completed());
		}
		this.scope = this.modulesPath;
		pk.redrawAll();
		this.notify();
	}

	/** The total an `auto` progress bar uses: this file's questions, or its modules. */
	autoTotal(source: string | undefined): number {
		if (source === "mcq-solved") return new Set(this.defs.flatMap((d) => d.ids)).size;
		if (source === "modules-completed") return this.defs.length;
		return 0;
	}

	/** Modules that exist in the file and have at least one question in the index. */
	live(hasQuestion: (id: string) => boolean): Set<string> {
		const out = new Set<string>();
		for (const d of this.defs) if (d.ids.some(hasQuestion)) out.add(d.key);
		return out;
	}

	/** Replace the state and persist it. */
	set(next: ScheduleState | null): void {
		const completedBefore = this.completed(this.state);
		this.state = next;
		this.notify();
		const text = next ? JSON.stringify(next) : null;
		this.writing = this.writing
			.then(async () => {
				const { adapter } = this.plugin.app.vault;
				if (text === null) {
					if (await adapter.exists(this.statePath)) await adapter.remove(this.statePath);
				} else {
					await adapter.write(this.statePath, text);
				}
			})
			.catch((e) => {
				new Notice(`Could not save the module schedule: ${String(e)}`);
			});
		// Completing a module (or resetting a completed one) moves the
		// `modules-completed` progress source.
		if (this.plugin.activity.enabled) {
			this.plugin.progress.addSource("modules-completed", this.completed(next) - completedBefore);
		}
	}

	/** Mature modules: every question seen, interval 21 days or more. */
	completed(state: ScheduleState | null = this.state): number {
		return completedCount(state, (k) => this.byKey.get(k)?.ids);
	}

	/** `result` is +1 right, −1 wrong, 0 skipped or unanswerable; `rating` is 0 Skip … 3 Easy. */
	logResponse(entry: { module: string; id: string; result: number; rating: number; day: number }): void {
		const line = JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n";
		this.writing = this.writing
			.then(async () => {
				const { adapter } = this.plugin.app.vault;
				if (await adapter.exists(this.logPath)) await adapter.append(this.logPath, line);
				else await adapter.write(this.logPath, line);
			})
			.catch((e) => {
				new Notice(`Could not log the answer: ${String(e)}`);
			});
	}

	onChange(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify(): void {
		for (const fn of this.listeners) fn();
	}
}
