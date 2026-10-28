import { normalizePath, Notice, TFile } from "obsidian";

import type McqSchedulerPlugin from "./main";
import { ModuleDef, parseModules } from "./modules";
import { completedCount, ScheduleState } from "./schedule";

/**
 * Loads and saves the module schedule, and keeps the parsed modules file.
 *
 * Both files live in the plugin folder, not the vault, so the plugin still
 * writes no notes:
 * - `schedule.json` — the whole {@link ScheduleState}, rewritten after every
 *   answer so an unfinished module survives a restart;
 * - `responses.jsonl` — one line per answer, appended, never rewritten.
 */
export class ScheduleStore {
	state: ScheduleState | null = null;
	defs: ModuleDef[] = [];
	byKey = new Map<string, ModuleDef>();
	private listeners = new Set<() => void>();
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
				this.state = JSON.parse(await adapter.read(this.statePath)) as ScheduleState;
			}
		} catch (e) {
			new Notice(`Could not read the module schedule: ${String(e)}`);
		}
	}

	/** Re-read the modules file. Cheap: one small note. */
	async reloadModules(): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(this.modulesPath);
		this.defs = file instanceof TFile ? parseModules(await this.plugin.app.vault.cachedRead(file)) : [];
		this.byKey = new Map(this.defs.map((d) => [d.key, d]));
		this.notify();
	}

	/** Modules that exist in the file and have at least one question in the index. */
	live(hasQuestion: (id: string) => boolean): Set<string> {
		const out = new Set<string>();
		for (const d of this.defs) if (d.ids.some(hasQuestion)) out.add(d.key);
		return out;
	}

	/** Replace the state and persist it. */
	set(next: ScheduleState | null): void {
		const completedBefore = completedCount(this.state);
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
			this.plugin.progress.addSource("modules-completed", completedCount(next) - completedBefore);
		}
	}

	logResponse(entry: { module: string; id: string; result: number; session: number }): void {
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
