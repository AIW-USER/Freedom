import { MarkdownView, Notice, Plugin, TFile } from "obsidian";

import { ActivityLog } from "./activity-log";
import { ConfirmModal } from "./confirm";
import { ProgressKeeper } from "./progress/progress";
import { McqIndex } from "./index";
import { parseMcq } from "./parser";
import { ScheduleStore } from "./schedule-store";
import { registerReadingHider } from "./reading";
import { RevealStore, syncAllViews } from "./reveal";
import { McqSettingTab } from "./settings";
import { TopicLabeller } from "./topics";
import { DEFAULT_SETTINGS, McqSettings } from "./types";
import { McqView, VIEW_TYPE_MCQ } from "./view";

/**
 * The plugin never writes to a note. The one exception is the MCQ activity
 * note (activity-log.ts), created once from a template when you start it and
 * never rewritten.
 *
 * It used to: answers were hidden by wrapping them in a collapsed callout, and
 * reading one flipped the fold marker, so every answer wrote the note twice.
 * Hiding is a rendering concern now (sections.ts, reading.ts, reveal.ts,
 * styles.css) — answering toggles one class on a few DOM nodes and the
 * markdown on disk never changes. The bank was stripped back to plain text
 * when that landed, and nothing here writes callouts any more.
 */
export default class McqSchedulerPlugin extends Plugin {
	// `Plugin.settings` exists as `unknown` since 1.13.0; `declare` narrows it.
	declare settings: McqSettings;
	index!: McqIndex;
	topics!: TopicLabeller;
	reveal!: RevealStore;
	activity!: ActivityLog;
	schedule!: ScheduleStore;
	progress!: ProgressKeeper;
	private checking = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.index = new McqIndex(this.app, () => this.settings.mcqFolder);
		this.topics = new TopicLabeller(this.app);
		// Piggy-back on the index walk: every OB note's `Topic:` wikilink and
		// its target's H1 are already in the metadata cache, so naming all 761
		// OB topics costs no extra disk reads.
		this.index.onEntryIndexed = (file, entry) => this.topics.primeFromCache(file, entry.topic);

		this.progress = new ProgressKeeper(this);
		await this.progress.load();
		this.activity = new ActivityLog(this);
		this.schedule = new ScheduleStore(this);
		await this.schedule.load();
		this.reveal = new RevealStore();
		registerReadingHider(this);
		// The post-processor reads the store as it renders, so a freshly opened
		// note comes up in the right state on its own. This sweep is for views
		// that are already mounted when the answer lands.
		this.register(this.reveal.onChange(() => syncAllViews(this.app, this.reveal)));

		this.registerView(VIEW_TYPE_MCQ, (leaf) => new McqView(leaf, this));
		this.addRibbonIcon("list-checks", "MCQ Scheduler", () => void this.activateView());
		this.addSettingTab(new McqSettingTab(this.app, this));

		this.addCommand({
			id: "open-browser",
			name: "Open browser",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "reveal-current",
			name: "Reveal the answer in the open note",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file?.path.startsWith(this.settings.mcqFolder + "/")) return false;
				if (!checking) this.reveal.answer(file.path);
				return true;
			},
		});
		this.addCommand({
			id: "start-activity-log",
			name: "Start monitoring (create the MCQ activity note)",
			checkCallback: (checking) => {
				if (!this.activity.canStart) return false;
				if (!checking) void this.activity.start();
				return true;
			},
		});
		this.addCommand({
			id: "reset-activity",
			name: "Reset activity…",
			callback: () =>
				new ConfirmModal(
					this.app,
					"Reset activity?",
					"Clears every question answered and every minute spent, today and in total, heat maps included. Modules completed follow the module schedule and are kept. This can't be undone.",
					"Reset",
					() => this.activity.reset(),
				).open(),
		});
		this.addCommand({
			id: "open-activity-log",
			name: "Open the MCQ activity note",
			checkCallback: (checking) => {
				if (!this.activity.noteExists) return false;
				if (!checking) void this.activity.open();
				return true;
			},
		});
		this.addCommand({
			id: "rebuild-index",
			name: "Rebuild the index",
			callback: () => void this.rebuildAndCheck(),
		});
		this.app.workspace.onLayoutReady(() => {
			this.index.rebuild();
			void this.schedule.reloadModules().then(() => this.activity.migrate());
			// Editing the modules file shows new modules in the Modules view
			// straight away; the schedule itself only changes when you place them.
			// The pane's Start button appears when the activity note is deleted
			// and goes when it is created.
			const noteMoved = (path: string) => {
				if (path === this.settings.activityPath) this.activity.notify();
			};
			this.registerEvent(this.app.vault.on("create", (f) => noteMoved(f.path)));
			this.registerEvent(this.app.vault.on("delete", (f) => noteMoved(f.path)));
			this.registerEvent(
				this.app.vault.on("rename", (f, old) => {
					noteMoved(f.path);
					noteMoved(old);
				}),
			);
			this.registerEvent(
				this.app.vault.on("modify", (file) => {
					if (file.path === this.schedule.modulesPath) void this.schedule.reloadModules();
				}),
			);
			// A note can be rendered long before or long after the answer that
			// reveals it — opened in a second leaf, or switched back from source
			// mode. Re-apply whenever the layout moves.
			// Spelled out rather than looped: `workspace.on` is typed per event
			// name, so a loop variable widens to a union no overload accepts.
			const sync = () => syncAllViews(this.app, this.reveal);
			this.registerEvent(this.app.workspace.on("file-open", sync));
			this.registerEvent(this.app.workspace.on("layout-change", sync));
			this.registerEvent(this.app.workspace.on("active-leaf-change", sync));
			// The metadata cache is usually still filling on a cold start of a
			// 12.5k-note vault, so rebuild once it settles. 'resolved' fires
			// again after later edits; the index is cheap enough to redo.
			this.registerEvent(
				this.app.metadataCache.on("resolved", () => {
					this.index.rebuild();
				}),
			);
			this.registerEvent(
				this.app.metadataCache.on("changed", (file, _data, cache) => {
					this.index.upsert(file, cache);
				}),
			);
			this.registerEvent(
				this.app.vault.on("delete", (file) => {
					if (file instanceof TFile) this.index.remove(file.path);
				}),
			);
			this.registerEvent(
				this.app.vault.on("rename", (file, oldPath) => {
					this.index.remove(oldPath);
					if (file instanceof TFile) this.index.upsert(file);
				}),
			);
		});
	}

	/**
	 * Keys that are no longer in DEFAULT_SETTINGS are dropped rather than
	 * carried along, so a setting removed from the plugin does not live on in
	 * data.json forever — and cannot quietly come back if the name is reused.
	 */
	onunload(): void {
		this.progress?.unload();
	}

	async loadSettings(): Promise<void> {
		const saved = ((await this.loadData()) ?? {}) as Partial<McqSettings>;
		const known: Partial<McqSettings> = {};
		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof McqSettings)[]) {
			if (key in saved) known[key] = saved[key] as never;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, known);
		// One level deeper for the progress settings, so a key added later gets its default.
		this.settings.progress = {
			...DEFAULT_SETTINGS.progress,
			statusBars: [...DEFAULT_SETTINGS.progress.statusBars],
			...(known.progress ?? {}),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Rebuild the index, then read every note in the MCQ folder and name any
	 * that does not follow `MCQ syntax.md`. The rebuild itself is metadata only;
	 * the check reads all the files, so it runs only when asked for.
	 */
	async rebuildAndCheck(): Promise<void> {
		if (this.checking) return;
		this.checking = true;
		try {
			this.index.rebuild();
			await this.schedule.reloadModules();
			const prefix = this.settings.mcqFolder + "/";
			const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
			const problems: string[] = [];
			await Promise.all(
				files.map(async (file) => {
					try {
						parseMcq(file.path, await this.app.vault.cachedRead(file));
					} catch (e) {
						const reason = e instanceof Error ? e.message.replace(`${file.path}: `, "") : String(e);
						problems.push(`${file.basename} — ${reason}`);
					}
				}),
			);
			problems.sort();

			const indexed = `${this.index.size.toLocaleString()} questions indexed.`;
			if (problems.length === 0) {
				new Notice(indexed);
				return;
			}
			const shown = problems.slice(0, 5).join("\n");
			const more = problems.length > 5 ? `\n…and ${problems.length - 5} more (see the console).` : "";
			const noun = problems.length === 1 ? "note doesn't" : "notes don't";
			new Notice(`${indexed}\n${problems.length} ${noun} follow MCQ syntax.md:\n${shown}${more}`, 15000);
			console.warn("MCQ scheduler: notes not following MCQ syntax.md\n" + problems.join("\n"));
		} finally {
			this.checking = false;
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MCQ)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			leaf = right;
			await leaf.setViewState({ type: VIEW_TYPE_MCQ, active: true });
		}
		await leaf.loadIfDeferred();
		await workspace.revealLeaf(leaf);
	}

	/** Push a settings change into every open browser pane. */
	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MCQ)) {
			const view = leaf.view;
			if (view instanceof McqView) view.refresh();
		}
	}

	/**
	 * Re-render every open MCQ note.
	 *
	 * The one legitimate use of `rerender`: a settings change alters what the
	 * post-processor would do, and that only takes effect on the next render.
	 * Answering a question never comes through here — it toggles a class.
	 */
	rerenderOpenNotes(): void {
		const prefix = this.settings.mcqFolder + "/";
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			if (!view.file?.path.startsWith(prefix)) continue;
			view.previewMode?.rerender(true);
		}
	}

}

