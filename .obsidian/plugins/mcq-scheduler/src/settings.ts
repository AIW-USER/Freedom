import { App, PluginSettingTab, Setting } from "obsidian";
import type McqSchedulerPlugin from "./main";
import { ConfirmModal } from "./confirm";
import { pad4 } from "./activity";
import { DEFAULT_SETTINGS } from "./types";

export class McqSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: McqSchedulerPlugin,
	) {
		super(app, plugin);
	}

	private deleteArmed = false;

	/** Counts from the progress history, the note, and the rarely used Reset. */
	private displayActivity(containerEl: HTMLElement): void {
		const log = this.plugin.activity;
		const pk = this.plugin.progress;
		new Setting(containerEl).setName("Activity").setHeading();

		const solved = pk.sourceTotals("mcq-solved");
		const time = pk.sourceTotals("mcq-time");
		new Setting(containerEl)
			.setName("MCQs solved")
			.setDesc(`Total ${pad4(solved.total)} · today ${pad4(solved.today)}`);
		new Setting(containerEl)
			.setName("Time spent (min)")
			.setDesc(`Total ${pad4(time.total)} · today ${pad4(time.today)}`);
		new Setting(containerEl)
			.setName("Modules completed")
			.setDesc(pad4(this.plugin.schedule.completed()));

		const monitor = new Setting(containerEl).setName("Monitoring");
		if (!log.enabled) {
			monitor
				.setDesc(
					"Off. Start to count the questions you answer and the time you spend, and create " +
						"MCQ activity.md at the vault root: progress bars for today, modules completed " +
						"against your dates, totals and heat maps. Edit goals and dates in that note.",
				)
				.addButton((b) =>
					b
						.setButtonText("Start monitoring")
						.setCta()
						.onClick(async () => {
							await log.start();
							this.display();
						}),
				);
		} else if (!log.noteExists) {
			monitor
				.setDesc(`On, but ${log.path} is missing. Recreate it from the template.`)
				.addButton((b) =>
					b.setButtonText("Recreate note").onClick(async () => {
						await log.start();
						this.display();
					}),
				);
		} else {
			monitor
				.setDesc(`On. Counting into ${log.path}.`)
				.addButton((b) => b.setButtonText("Open note").onClick(() => void log.open()));
		}

		new Setting(containerEl)
			.setName("Reset activity")
			.setDesc(
				"Clears every question answered and minute spent, today and in total, heat maps " +
					"included. Modules completed follow the module schedule and are kept.",
			)
			.addButton((b) =>
				b
					.setButtonText("Reset…")
					.setWarning()
					.onClick(() =>
						new ConfirmModal(
							this.app,
							"Reset activity?",
							"Clears every question answered and every minute spent, today and in total, heat maps included. This can't be undone.",
							"Reset",
							() => {
								log.reset();
								this.display();
							},
						).open(),
					),
			);
	}

	/** Progress bar defaults and the status bar, as in Progress Keeper. */
	private displayProgress(containerEl: HTMLElement): void {
		const pk = this.plugin.progress;
		const ps = this.plugin.settings.progress;
		new Setting(containerEl).setName("Progress bars").setHeading();

		new Setting(containerEl)
			.setName("Default on-track window")
			.setDesc(
				"Percentage points either side of the expected progress that still count as on track " +
					"(blue). A bar's own `window:` line overrides it.",
			)
			.addText((t) =>
				t.setValue(String(ps.defaultWindow)).onChange(async (v) => {
					const n = Number(v);
					if (!(n >= 0)) return;
					ps.defaultWindow = n;
					await this.plugin.saveSettings();
					await pk.rescan();
				}),
			);

		new Setting(containerEl)
			.setName("Default digits")
			.setDesc(
				"Numbers in a bar's fraction are padded to at least this many digits: 4 shows " +
					"0050/0100. 0 turns padding off. A bar's own `digits:` line overrides it.",
			)
			.addText((t) =>
				t.setValue(String(ps.defaultDigits)).onChange(async (v) => {
					const n = Number(v);
					if (!Number.isInteger(n) || n < 0 || n > 10) return;
					ps.defaultDigits = n;
					await this.plugin.saveSettings();
					await pk.rescan();
					pk.redrawAll();
				}),
			);

		new Setting(containerEl)
			.setName("Show titles in the status bar")
			.addToggle((t) =>
				t.setValue(ps.statusShowTitle).onChange(async (v) => {
					ps.statusShowTitle = v;
					await this.plugin.saveSettings();
					pk.refreshStatusBar();
				}),
			);

		new Setting(containerEl)
			.setName("Sunday relief")
			.setDesc(
				"Lower the goal of daily bars (every: 1 day) on Sundays, questions and minutes " +
					"included. A bar's own `sunday:` line overrides this.",
			)
			.addToggle((t) =>
				t.setValue(ps.sundayRelief).onChange(async (v) => {
					ps.sundayRelief = v;
					await this.plugin.saveSettings();
					pk.redrawAll();
					this.display();
				}),
			);

		if (ps.sundayRelief) {
			new Setting(containerEl)
				.setName("Sunday relief (%)")
				.setDesc(
					"How much lower the Sunday goal is: 50 turns 100 into 50, 100 makes Sunday a rest day.",
				)
				.addText((t) =>
					t.setValue(String(ps.sundayReliefPercent)).onChange(async (v) => {
						const n = Number(v.replace(/%$/, "").trim());
						if (!(n >= 0 && n <= 100)) return;
						ps.sundayReliefPercent = n;
						await this.plugin.saveSettings();
						pk.redrawAll();
					}),
				);
		}

		new Setting(containerEl)
			.setName("Status bar")
			.setHeading()
			.setDesc("Pinned bars appear left of backlinks and word count, in this order.");

		const ids = new Set(pk.registry.all().map((e) => e.spec.id));
		// Pinned first (in order, including ones not currently found), then the rest.
		const rows = [...ps.statusBars, ...[...ids].filter((id) => !ps.statusBars.includes(id))];
		if (!rows.length) {
			containerEl.createEl("p", {
				cls: "setting-item-description",
				text: "No progress bars found in the vault yet.",
			});
		}
		for (const id of rows) {
			const pinned = ps.statusBars.indexOf(id);
			const entries = pk.registry.find(id);
			const desc = entries.length ? entries.map((e) => e.path).join(", ") : "Not found in any note";
			const row = new Setting(containerEl).setName(id).setDesc(desc);
			if (pinned >= 0) {
				row.addExtraButton((b) =>
					b
						.setIcon("arrow-up")
						.setTooltip("Move left")
						.setDisabled(pinned === 0)
						.onClick(async () => {
							await pk.movePinned(pinned, -1);
							this.display();
						}),
				);
				row.addExtraButton((b) =>
					b
						.setIcon("arrow-down")
						.setTooltip("Move right")
						.setDisabled(pinned === ps.statusBars.length - 1)
						.onClick(async () => {
							await pk.movePinned(pinned, 1);
							this.display();
						}),
				);
			}
			row.addToggle((t) =>
				t.setValue(pinned >= 0).onChange(async () => {
					await pk.togglePinned(id);
					this.display();
				}),
			);
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("MCQ folder")
			.setDesc("Vault-relative folder holding the question notes.")
			.addText((t) =>
				t.setValue(s.mcqFolder).onChange(async (v) => {
					s.mcqFolder = v.trim().replace(/\/+$/, "");
					await this.plugin.saveSettings();
					this.plugin.index.rebuild();
				}),
			);

		new Setting(containerEl).setName("Reading view").setHeading();

		new Setting(containerEl)
			.setName("Hide answers in reading view")
			.setDesc(
				"“Options” and “Correct option” never render in reading view; " +
					"“Answer explanation” and “Illustrations” appear the moment you answer in " +
					"the pane, right or wrong. Nothing is written to the note — Ctrl+E (source " +
					"mode) always shows the whole file, and so does Live Preview.",
			)
			.addToggle((t) =>
				t.setValue(s.hideInReadingView).onChange(async (v) => {
					s.hideInReadingView = v;
					await this.plugin.saveSettings();
					// Hiding is decided as a note renders, so an open one has to
					// be re-rendered for the change to show.
					this.plugin.rerenderOpenNotes();
				}),
			);

		new Setting(containerEl).setName("Answering").setHeading();

		new Setting(containerEl)
			.setName("Open the note when a question is selected")
			.addToggle((t) =>
				t.setValue(s.autoOpenFile).onChange(async (v) => {
					s.autoOpenFile = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Reading the answer")
			.setDesc(
				"Pick any option and the explanation and illustrations appear in the note by " +
					"themselves — no second click, and nothing written to disk. Moving to the " +
					"next question hides them again, so a question you come back to still asks " +
					"you. “Reveal the answer in the open note” in the command palette opens one " +
					"without answering.",
			);

		new Setting(containerEl)
			.setName("Option size")
			.setDesc(
				"Size of the option buttons, as a percentage of your theme's body text. " +
					"Takes effect immediately in any open pane.",
			)
			.addSlider((sl) =>
				sl
					.setLimits(80, 200, 5)
					.setValue(s.optionScale)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.optionScale = v;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			)
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip("Reset to 100%")
					.onClick(async () => {
						s.optionScale = DEFAULT_SETTINGS.optionScale;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Maximum search results")
			.addSlider((sl) =>
				sl
					.setLimits(50, 500, 50)
					.setValue(s.searchResultCap)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.searchResultCap = v;
						await this.plugin.saveSettings();
					}),
			);

		this.displayActivity(containerEl);

		this.displayProgress(containerEl);

		new Setting(containerEl).setName("Modules").setHeading();

		new Setting(containerEl)
			.setName("Modules file")
			.setDesc("Vault path of the note listing the modules, e.g. Question Modules.md.")
			.addText((t) =>
				t.setValue(s.modulesFile).onChange(async (v) => {
					s.modulesFile = v.trim();
					await this.plugin.saveSettings();
					await this.plugin.schedule.reloadModules();
				}),
			);

		const num = (name: string, desc: string, get: () => number, set: (n: number) => void, min: number, max: number) =>
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addText((t) => {
					t.inputEl.type = "number";
					t.setValue(String(get())).onChange(async (v) => {
						const n = Math.floor(Number(v));
						if (!Number.isFinite(n) || n < min || n > max) return;
						set(n);
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
				});
		num(
			"New modules per day",
			"How many modules from the head of the queue are introduced each study day.",
			() => s.newPerDay,
			(n) => (s.newPerDay = n),
			0,
			9999,
		);
		num(
			"Maximum reviews per day",
			"Reviews beyond this wait for the next day.",
			() => s.reviewsPerDay,
			(n) => (s.reviewsPerDay = n),
			0,
			9999,
		);
		num(
			"Next day starts at (hour)",
			"0–23. Study after midnight but before this hour counts towards the day before. Default 4.",
			() => s.dayStartHour,
			(n) => (s.dayStartHour = n),
			0,
			23,
		);

		new Setting(containerEl)
			.setName("Delete the module schedule")
			.setDesc(
				"Forgets every module's interval, ease and question history so the schedule can be " +
					"created afresh. The answer log (responses.jsonl) is kept. Press twice to confirm.",
			)
			.addButton((b) => {
				const armed = this.deleteArmed;
				b.setButtonText(armed ? "Confirm delete" : "Delete");
				if (armed) b.setWarning();
				b.onClick(() => {
					if (!this.deleteArmed) {
						this.deleteArmed = true;
						window.setTimeout(() => {
							this.deleteArmed = false;
							this.display();
						}, 3000);
						this.display();
						return;
					}
					this.deleteArmed = false;
					this.plugin.schedule.set(null);
					this.display();
				});
			});

		new Setting(containerEl).setName("Maintenance").setHeading();

		new Setting(containerEl)
			.setName("Rebuild the index")
			.setDesc(
				"Picks up new or edited questions, then checks every note against MCQ syntax.md " +
					"and names any that do not follow it.",
			)
			.addButton((b) =>
				b.setButtonText("Rebuild").onClick(() => void this.plugin.rebuildAndCheck()),
			);
	}
}
