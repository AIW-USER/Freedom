import {
	App,
	FuzzySuggestModal,
	ItemView,
	Notice,
	TFile,
	WorkspaceLeaf,
	prepareFuzzySearch,
	prepareSimpleSearch,
	setIcon,
	debounce,
} from "obsidian";

import type McqSchedulerPlugin from "./main";
import { pad4, QUESTION_TIME_CAP_MS } from "./activity";
import { QuestionClock } from "./clock";
import { IndexEntry } from "./index";
import { parseMcq } from "./parser";
import type { ModuleDef } from "./modules";
import {
	answer as rateModule,
	createSchedule,
	dayStartMs,
	effectiveDay,
	formatDays,
	formatWait,
	introducedCount,
	isDone,
	isMature,
	LEARN_AHEAD_MS,
	Limits,
	ModuleCard,
	moveInQueue,
	Move,
	newCard,
	nextModule,
	nextQuestion,
	PickKind,
	Placement,
	placeModules,
	previewIntervals,
	Rating,
	RATING_LABELS,
	resetModule,
	reveal,
	setCurrent,
	studyAhead,
	studyDay,
	todayStats,
	TodayStats,
	unplacedModules,
} from "./schedule";
import { MCQ, Section, SECTION_LABELS } from "./types";

export const VIEW_TYPE_MCQ = "mcq-scheduler-browser";

type Level = "sections" | "topics" | "questions";
type Mode = "browse" | "modules";
type ModTab = "queue" | "learning" | "completed";

/** `answered` value for a skipped question: the answer is shown, nothing was chosen. */
const SKIPPED = -1;

/** Rating keys in Modules mode. The option keys are digits, so these never clash. */
const RATING_KEYS: Record<string, Rating> = { s: 0, h: 1, g: 2, " ": 2, e: 3 };

const KIND_LABEL: Record<PickKind, string> = { new: "New module", learning: "Learning", review: "Review" };

export class McqView extends ItemView {
	navigation = false;

	private mode: Mode = "browse";
	/** In Modules mode: answering the day's modules, rather than on the home list. */
	private studying = false;
	private modTab: ModTab = "queue";
	/** When the done-for-today card should redraw, because a learning module falls due. */
	private wakeAt: number | null = null;
	private modeEl!: HTMLElement;
	private unsubscribeSchedule: (() => void) | null = null;

	private level: Level = "sections";
	private section: Section | null = null;
	private topic: string | null = null;
	private query = "";
	private globalSearch = false;

	private current: MCQ | null = null;
	private currentPath: string | null = null;
	private answered: number | null = null;

	/** Time to answer / time on the question. Monotonic, so a system clock change cannot jump it. */
	private clock = new QuestionClock(() => performance.now());
	/** Rebuilt with the quiz pane on every render; null while no question is open. */
	private clockEl: HTMLElement | null = null;
	/** Time on the open question already handed to the activity log. */
	private loggedMs = 0;

	/** Parsed notes for the topic on screen, so a re-render costs no I/O. */
	private previews = new Map<string, MCQ>();
	/** Sections whose topic labels have already been filled in. */
	private labelled = new Set<Section>();

	private listEl!: HTMLElement;
	private crumbEl!: HTMLElement;
	private quizEl!: HTMLElement;
	private searchEl!: HTMLInputElement;
	private unsubscribe: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: McqSchedulerPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_MCQ;
	}

	getDisplayText(): string {
		return "MCQ Scheduler";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("mcq-view");

		const header = root.createDiv({ cls: "mcq-header" });
		this.modeEl = header.createDiv({ cls: "mcq-mode" });
		this.crumbEl = header.createDiv({ cls: "mcq-breadcrumb" });

		const search = header.createDiv({ cls: "mcq-search" });
		this.searchEl = search.createEl("input", {
			cls: "mcq-search-input",
			attr: { type: "text", placeholder: "Search…" },
		});
		const scope = search.createEl("button", { cls: "mcq-search-scope", text: "This level" });
		const rebuild = search.createEl("button", {
			cls: "mcq-rebuild clickable-icon",
			attr: { "aria-label": "Rebuild index and check syntax" },
		});
		setIcon(rebuild, "refresh-cw");
		rebuild.addEventListener("click", () => void this.plugin.rebuildAndCheck());
		scope.addEventListener("click", () => {
			this.globalSearch = !this.globalSearch;
			scope.setText(this.globalSearch ? "All questions" : "This level");
			scope.toggleClass("is-active", this.globalSearch);
			this.renderList();
		});

		const onInput = debounce(
			() => {
				this.query = this.searchEl.value.trim();
				this.renderList();
			},
			150,
			true,
		);
		this.registerDomEvent(this.searchEl, "input", onInput);

		this.listEl = root.createDiv({ cls: "mcq-list" });
		this.quizEl = root.createDiv({ cls: "mcq-quiz" });

		this.registerDomEvent(root, "keydown", (evt) => this.onKeyDown(evt));
		this.unsubscribe = this.plugin.index.onChange(() => this.renderList());
		this.unsubscribeSchedule = this.plugin.schedule.onChange(() => {
			if (this.mode === "modules") this.renderList();
		});
		// A quarter-second tick keeps each second's change close to on time;
		// tickClock only touches the DOM when the text actually changes.
		// registerInterval clears it when the pane closes.
		this.registerInterval(window.setInterval(() => this.tickClock(), 250));
		this.registerInterval(window.setInterval(() => this.wake(), 15_000));

		this.applyOptionScale();
		this.render();
	}

	/** Re-read settings and redraw. Called when the settings tab changes. */
	refresh(): void {
		this.applyOptionScale();
		this.render();
	}

	/**
	 * Option sizing is driven by one custom property rather than by setting
	 * sizes from script, so a theme or snippet can still override the rules.
	 */
	private applyOptionScale(): void {
		const scale = this.plugin.settings.optionScale / 100;
		this.contentEl.style.setProperty("--mcq-option-scale", String(scale));
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.unsubscribeSchedule?.();
		this.unsubscribeSchedule = null;
		this.logTime();
		// Closing the pane ends the session: nothing is left revealed behind it.
		this.plugin.reveal.clear();
	}

	// ---------------------------------------------------------------- render

	private render(): void {
		this.renderMode();
		this.renderCrumbs();
		this.renderList();
		this.renderQuiz();
	}

	private renderMode(): void {
		this.modeEl.empty();
		for (const mode of ["browse", "modules"] as Mode[]) {
			const b = this.modeEl.createEl("button", {
				cls: "mcq-mode-btn",
				text: mode === "browse" ? "Browse" : "Modules",
			});
			b.toggleClass("is-active", this.mode === mode);
			b.addEventListener("click", () => this.setMode(mode));
		}
	}

	/** Leaving a mode closes the open question; an unfinished module waits under Resume. */
	private setMode(mode: Mode): void {
		if (mode === this.mode) return;
		this.leaveQuestion();
		this.mode = mode;
		this.studying = false;
		this.resetSearch();
		if (mode === "modules") void this.plugin.schedule.reloadModules();
		this.render();
	}

	private leaveQuestion(): void {
		this.logTime();
		this.current = null;
		this.currentPath = null;
		this.answered = null;
		this.plugin.reveal.clear();
	}

	private renderCrumbs(): void {
		this.crumbEl.empty();
		if (this.mode === "modules") return this.renderModuleCrumbs();

		const crumb = (label: string, onClick: (() => void) | null) => {
			if (this.crumbEl.childElementCount > 0) {
				this.crumbEl.createSpan({ cls: "mcq-crumb-sep", text: "›" });
			}
			if (!onClick) {
				this.crumbEl.createSpan({ cls: "mcq-crumb is-current", text: label });
				return;
			}
			const b = this.crumbEl.createEl("button", { cls: "mcq-crumb", text: label });
			b.addEventListener("click", onClick);
		};

		crumb(
			"All",
			this.level === "sections"
				? null
				: () => {
						this.level = "sections";
						this.section = null;
						this.topic = null;
						this.resetSearch();
						this.render();
					},
		);

		if (this.section) {
			crumb(
				SECTION_LABELS[this.section],
				this.level === "topics"
					? null
					: () => {
							this.level = "topics";
							this.topic = null;
							this.resetSearch();
							this.render();
						},
			);
		}
		if (this.topic) crumb(this.plugin.topics.label(this.topic), null);
	}

	/**
	 * Hand the open question's time since the last call to the activity log,
	 * up to the per-question cap. Called on answering and on leaving the
	 * question, so the count is current after each answer and the reading
	 * time lands when you move on.
	 */
	private logTime(): void {
		if (!this.current) return;
		const upTo = Math.min(this.clock.totalMs(), QUESTION_TIME_CAP_MS);
		const delta = upTo - this.loggedMs;
		this.loggedMs = upTo;
		this.plugin.activity.recordTime(delta);
	}

	private resetSearch(): void {
		this.query = "";
		if (this.searchEl) this.searchEl.value = "";
	}

	private renderList(): void {
		if (!this.listEl) return;
		this.listEl.empty();

		const searching = this.globalSearch && this.query !== "";
		// Flagged on the root, not on the list, because the rule it drives has
		// to reach the quiz pane too. It tracks what is actually on screen
		// rather than `level`, since a global search shows questions from any
		// level.
		this.contentEl.toggleClass(
			"is-sections",
			this.mode === "browse" && !searching && this.level === "sections",
		);
		if (this.mode === "modules") return this.renderModules();

		if (searching) {
			this.renderQuestionRows(this.searchAll(), true);
			return;
		}

		if (this.level === "sections") return this.renderSections();
		if (this.level === "topics") return this.renderTopics();
		return this.renderQuestions();
	}

	private renderSections(): void {
		const all = this.plugin.index.sections();
		const matches = this.filter(all, (s) => s.label);
		if (matches.length === 0) return this.renderEmpty("No sections indexed yet.");

		for (const s of matches) {
			const row = this.listEl.createDiv({ cls: "mcq-row is-section", attr: { tabindex: "0" } });
			row.createSpan({ cls: "mcq-row-label", text: s.label });
			row.createSpan({ cls: "mcq-row-meta", text: `${s.topics} topics · ${s.count}` });
			const open = () => {
				this.section = s.section;
				this.level = "topics";
				this.resetSearch();
				this.render();
			};
			row.addEventListener("click", open);
			row.addEventListener("keydown", (e) => {
				if (e.key === "Enter") open();
			});
		}
	}

	private renderTopics(): void {
		if (!this.section) return;
		const labeller = this.plugin.topics;
		const all = this.plugin.index.topics(this.section);

		// Most topics are named straight from the metadata cache. The rest need
		// one small read each, so render now and refresh once those land.
		if (!this.labelled.has(this.section) && all.some((t) => !labeller.hasLabel(t.topic))) {
			const section = this.section;
			this.labelled.add(section);
			void labeller
				.ensureTopicLabels(all.map((t) => this.plugin.index.questions(section, t.topic)[0]))
				.then(() => {
					if (this.section === section && this.level === "topics") this.renderList();
				});
		}

		const named = all.map((t) => ({ ...t, label: labeller.label(t.topic) }));
		named.sort((a, b) => a.label.localeCompare(b.label));
		const matches = this.filter(named, (t) => t.label);
		if (matches.length === 0) return this.renderEmpty("No topics match.");

		for (const t of matches) {
			const row = this.listEl.createDiv({ cls: "mcq-row is-topic", attr: { tabindex: "0" } });
			row.createSpan({ cls: "mcq-row-label", text: t.label });
			row.createSpan({ cls: "mcq-row-meta", text: String(t.count) });
			const open = () => {
				this.topic = t.topic;
				this.level = "questions";
				this.resetSearch();
				void this.loadTopic();
			};
			row.addEventListener("click", open);
			row.addEventListener("keydown", (e) => {
				if (e.key === "Enter") open();
			});
		}
	}

	private async loadTopic(): Promise<void> {
		if (!this.section || !this.topic) return;
		const entries = this.plugin.index.questions(this.section, this.topic);
		this.previews.clear();

		// At most 135 notes in the largest topic — a few hundred KB.
		await Promise.all(
			entries.map(async (e) => {
				const file = this.app.vault.getFileByPath(e.path);
				if (!(file instanceof TFile)) return;
				try {
					const content = await this.app.vault.cachedRead(file);
					this.previews.set(e.path, parseMcq(e.path, content));
				} catch {
					/* a single unparseable note should not break the list */
				}
			}),
		);
		this.render();
	}

	private renderQuestions(): void {
		if (!this.section || !this.topic) return;
		const entries = this.plugin.index.questions(this.section, this.topic);
		const matches = this.query
			? this.filter(entries, (e) => this.previews.get(e.path)?.questionText ?? e.id)
			: entries;
		this.renderQuestionRows(matches, false);
	}

	private renderQuestionRows(entries: IndexEntry[], showTopic: boolean): void {
		const cap = this.plugin.settings.searchResultCap;
		const shown = entries.slice(0, cap);
		if (shown.length === 0) return this.renderEmpty("No questions match.");

		shown.forEach((e, i) => {
			const row = this.listEl.createDiv({ cls: "mcq-row is-question", attr: { tabindex: "0" } });
			row.toggleClass("is-active", e.path === this.currentPath);
			row.createSpan({ cls: "mcq-row-index", text: String(i + 1) });
			row.createSpan({ cls: `mcq-row-badge is-${e.family.toLowerCase()}`, text: e.family });
			row.createSpan({ cls: "mcq-row-label", text: e.id });
			if (showTopic) {
				row.createSpan({
					cls: "mcq-row-meta",
					text: `${SECTION_LABELS[e.section]} · ${this.plugin.topics.label(e.topic)}`,
				});
			}

			const open = () => void this.select(e);
			row.addEventListener("click", open);
			row.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter") open();
			});
		});

		if (entries.length > shown.length) {
			this.listEl.createDiv({
				cls: "mcq-list-footer",
				text: `Showing ${shown.length} of ${entries.length} — refine your search`,
			});
		}
	}

	private renderEmpty(text: string): void {
		this.listEl.createDiv({ cls: "mcq-list-footer", text });
	}

	// ----------------------------------------------------------------- quiz

	private async select(entry: IndexEntry): Promise<void> {
		const file = this.app.vault.getFileByPath(entry.path);
		if (!(file instanceof TFile)) {
			new Notice(`Cannot find ${entry.path}`);
			return;
		}

		let mcq = this.previews.get(entry.path);
		if (!mcq) {
			try {
				mcq = parseMcq(entry.path, await this.app.vault.cachedRead(file));
				this.previews.set(entry.path, mcq);
			} catch (e) {
				new Notice(`Could not read ${entry.id}: ${String(e)}`);
				return;
			}
		}

		// Close out the question being left before its clock restarts.
		this.logTime();
		this.current = mcq;
		this.currentPath = entry.path;
		this.answered = null;
		// Every way of changing question — Next, Previous, a rating, keys, a
		// row, a search result — comes through here, so this one reset covers
		// them all.
		this.clock.start();
		this.loggedMs = 0;
		// Before the note is opened, so the outgoing one re-hides without the
		// reveal being visible for a frame on the way out.
		this.plugin.reveal.clear();
		// A question answered but not yet rated comes back as it was left, so
		// a resumed question shows what you chose.
		const cur = this.inStudy() ? this.plugin.schedule.state?.current : null;
		const prior = cur?.id === entry.id ? cur.revealed : null;
		if (prior) {
			this.answered = prior.chosen ?? SKIPPED;
			this.clock.markAnswered();
			this.plugin.reveal.answer(entry.path);
		}

		if (this.plugin.settings.autoOpenFile) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}

		this.renderList();
		this.renderQuiz();
	}

	private renderQuiz(): void {
		if (!this.quizEl) return;
		this.quizEl.empty();
		this.quizEl.removeClass("is-paused");
		this.clockEl = null;
		const mcq = this.current;
		if (!mcq) {
			this.quizEl.createDiv({
				cls: "mcq-quiz-empty",
				text: this.mode === "modules" ? "Press Study to begin." : "Pick a question to begin.",
			});
			return;
		}

		// Nothing is rendered above the options: the question, its images and
		// its identity are all right there in the open note.
		const unknown = mcq.correctIndex === null;
		this.quizEl.toggleClass("is-unknown", unknown);

		const list = this.quizEl.createDiv({ cls: "mcq-options", attr: { role: "radiogroup" } });
		for (const option of mcq.options) {
			const btn = list.createEl("button", {
				cls: "mcq-option",
				attr: { "data-index": String(option.index) },
			});
			btn.createSpan({ cls: "mcq-option-label", text: option.label });
			btn.createSpan({ cls: "mcq-option-text", text: option.text });
			btn.createSpan({ cls: "mcq-option-mark" });
			btn.addEventListener("click", () => this.answer(option.index));
		}

		const feedback = this.quizEl.createDiv({
			cls: "mcq-feedback",
			attr: { role: "status", "aria-live": "polite" },
		});
		if (unknown) feedback.setText("No answer was recorded for this question.");

		if (this.inStudy()) return this.renderRatings();

		// Just the two steps. Answering reveals the explanation in the note by
		// itself; the pane never touches the file.
		const actions = this.quizEl.createDiv({ cls: "mcq-actions" });
		const prev = actions.createEl("button", { cls: "mcq-btn", text: "◂ Previous" });
		prev.addEventListener("click", () => void this.step(-1));
		const skip = actions.createEl("button", {
			cls: "mcq-btn",
			text: "Skip",
			attr: { "aria-label": "Show the answer without choosing (scores 0)" },
		});
		skip.disabled = this.answered !== null;
		skip.addEventListener("click", () => this.skip());
		const next = actions.createEl("button", { cls: "mcq-btn", text: "Next ▸" });
		next.addEventListener("click", () => void this.step(1));
		this.clockEl = actions.createSpan({
			cls: "mcq-clock",
			attr: { "aria-label": "Answer time / time on question" },
		});
		this.tickClock();

		// Disabled at the ends of the topic, so the buttons show where you are
		// rather than only saying so once you press them.
		const at = this.positionInTopic();
		prev.disabled = at === null || at.index <= 0;
		next.disabled = at === null || at.index >= at.total - 1;

		if (this.answered !== null) this.paintAnswer(this.answered);
	}

	/**
	 * Modules mode: Skip · Hard · Good · Easy, each with the wait it would
	 * schedule. Until the answer is shown only Skip works, and it shows the
	 * answer; after that every button rates the module and moves on.
	 */
	private renderRatings(): void {
		const state = this.plugin.schedule.state;
		const cur = state?.current;
		if (!state || !cur) return;
		if (this.clock.isPaused()) return this.renderPaused();
		const card = state.cards[cur.key] ?? newCard();
		const now = Date.now();
		const waits = previewIntervals(card, now, effectiveDay(state, now, this.limits().dayStartHour));
		const revealed = this.answered !== null;

		const row = this.quizEl.createDiv({ cls: "mcq-actions mcq-ratings" });
		RATING_LABELS.forEach((label, r) => {
			const b = row.createEl("button", { cls: `mcq-btn mcq-rate is-r${r}` });
			b.createSpan({ cls: "mcq-rate-label", text: label });
			b.createSpan({ cls: "mcq-rate-wait", text: r === 0 && !revealed ? "show answer" : waits[r] });
			b.disabled = r > 0 && !revealed;
			b.addEventListener("click", () => (r === 0 && !revealed ? this.skip() : void this.rate(r as Rating)));
		});
		// Stop at the left margin, the clock at the right, on one line under the ratings.
		const foot = row.createDiv({ cls: "mcq-rate-foot" });
		const stop = foot.createEl("button", {
			cls: "mcq-stop",
			text: "⏸ Stop",
			attr: { "aria-label": "Pause: freeze the clock and lock the answers (c)" },
		});
		stop.addEventListener("click", () => this.stop());
		this.clockEl = foot.createSpan({
			cls: "mcq-clock",
			attr: { "aria-label": "Answer time / time on question" },
		});
		this.tickClock();

		if (this.answered !== null) this.paintAnswer(this.answered);
	}

	/** Paused: the options locked and dimmed, the clock frozen, Continue or End session. */
	private renderPaused(): void {
		this.quizEl.addClass("is-paused");
		this.quizEl.querySelectorAll<HTMLButtonElement>(".mcq-option").forEach((b) => (b.disabled = true));
		if (this.answered !== null) this.paintAnswer(this.answered);
		this.quizEl.createDiv({ cls: "mcq-paused", text: "Paused — the clock is stopped." });
		const row = this.quizEl.createDiv({ cls: "mcq-actions" });
		const cont = row.createEl("button", { cls: "mod-cta", text: "▶ Continue" });
		cont.addEventListener("click", () => this.cont());
		const end = row.createEl("button", { cls: "mcq-btn", text: "End session" });
		end.addEventListener("click", () => this.goModulesHome());
		this.clockEl = row.createSpan({
			cls: "mcq-clock",
			attr: { "aria-label": "Answer time / time on question" },
		});
		this.tickClock();
	}

	/** Stop: freeze the question. Time up to now is logged; paused time never is. */
	private stop(): void {
		if (!this.inStudy() || this.clock.isPaused()) return;
		this.logTime();
		this.clock.pause();
		this.renderQuiz();
	}

	/** Continue: the same question, as it was. */
	private cont(): void {
		if (!this.clock.isPaused()) return;
		this.clock.resume();
		this.renderQuiz();
	}

	private answer(index: number): void {
		const mcq = this.current;
		if (!mcq || this.answered !== null || this.clock.isPaused()) return;
		this.answered = index;
		this.clock.markAnswered();
		this.tickClock();
		this.plugin.activity.recordSolved();
		this.logTime();
		this.paintAnswer(index);
		this.markRevealed(index);
		// Any answer reveals, right or wrong: committing to an option is the
		// price of the explanation. The keyboard path lands here too.
		this.plugin.reveal.answer(mcq.path);
	}

	/**
	 * Show the answer without choosing; not counted as solved. In Modules
	 * mode, once the answer is showing, Skip is the poorest rating.
	 */
	private skip(): void {
		const mcq = this.current;
		if (!mcq || this.clock.isPaused()) return;
		if (this.answered !== null) {
			if (this.inStudy()) void this.rate(0);
			return;
		}
		this.answered = SKIPPED;
		this.clock.markAnswered();
		this.tickClock();
		this.logTime();
		this.paintAnswer(SKIPPED);
		this.plugin.reveal.answer(mcq.path);
		this.quizEl.querySelectorAll<HTMLButtonElement>(".mcq-actions .mcq-btn").forEach((b) => {
			if (b.textContent === "Skip") b.disabled = true;
		});
		this.markRevealed(null);
	}

	/** Remember that the answer is showing, so a resumed question repaints, and unlock the ratings. */
	private markRevealed(chosen: number | null): void {
		if (!this.inStudy()) return;
		const store = this.plugin.schedule;
		const state = store.state;
		if (!state?.current || state.current.id !== this.current?.id) return;
		store.set(reveal(state, chosen));
		this.renderQuiz();
	}

	private paintAnswer(chosen: number): void {
		const mcq = this.current;
		if (!mcq) return;

		const buttons = Array.from(this.quizEl.querySelectorAll<HTMLElement>(".mcq-option"));
		for (const btn of buttons) btn.addClass("is-disabled");

		const mark = (i: number, cls: string, icon: string) => {
			const btn = buttons[i];
			if (!btn) return;
			btn.addClass(cls);
			const slot = btn.querySelector<HTMLElement>(".mcq-option-mark");
			if (slot) setIcon(slot, icon);
		};

		const feedback = this.quizEl.querySelector<HTMLElement>(".mcq-feedback");
		if (chosen === SKIPPED) {
			if (mcq.correctIndex !== null) mark(mcq.correctIndex, "is-correct", "check");
			if (feedback) {
				feedback.removeClass("is-correct", "is-wrong");
				feedback.setText(
					mcq.correctIndex === null
						? "Skipped — no answer was recorded for this question."
						: `Skipped — the answer is ${mcq.options[mcq.correctIndex].label}`,
				);
			}
			return;
		}
		if (mcq.correctIndex === null) {
			mark(chosen, "is-chosen", "help-circle");
			if (feedback) feedback.setText("No answer was recorded for this question.");
			return;
		}

		mark(mcq.correctIndex, "is-correct", "check");
		if (chosen === mcq.correctIndex) {
			buttons[chosen]?.addClass("is-chosen");
			if (feedback) {
				feedback.setText("Correct");
				feedback.removeClass("is-wrong");
				feedback.addClass("is-correct");
			}
		} else {
			mark(chosen, "is-wrong", "x");
			buttons[chosen]?.addClass("is-chosen");
			if (feedback) {
				feedback.setText(`Incorrect — the answer is ${mcq.options[mcq.correctIndex].label}`);
				feedback.removeClass("is-correct");
				feedback.addClass("is-wrong");
			}
		}
	}

	private tickClock(): void {
		if (!this.clockEl) return;
		const text = this.clock.text();
		if (this.clockEl.textContent !== text) this.clockEl.setText(text);
	}

	/** Where the open question sits in its topic, or null if it is not in one. */
	private positionInTopic(): { entries: IndexEntry[]; index: number; total: number } | null {
		if (this.mode === "modules") return null;
		if (!this.section || !this.topic || !this.currentPath) return null;
		const entries = this.plugin.index.questions(this.section, this.topic);
		const index = entries.findIndex((e) => e.path === this.currentPath);
		return index === -1 ? null : { entries, index, total: entries.length };
	}

	/** Move by one question within the current topic. -1 back, +1 forward. */
	private async step(delta: -1 | 1): Promise<void> {
		const at = this.positionInTopic();
		if (!at) return;
		const target = at.index + delta;
		if (target < 0) {
			new Notice("That was the first question in this topic.");
			return;
		}
		if (target >= at.total) {
			new Notice("That was the last question in this topic.");
			return;
		}
		await this.select(at.entries[target]);
	}

	// -------------------------------------------------------------- modules

	/** Answering a module's question in Modules mode. */
	private inStudy(): boolean {
		return this.mode === "modules" && this.studying && !!this.plugin.schedule.state?.current;
	}

	private limits(): Limits {
		const s = this.plugin.settings;
		return { newPerDay: s.newPerDay, reviewsPerDay: s.reviewsPerDay, dayStartHour: s.dayStartHour };
	}

	private pathFor(id: string): string {
		return `${this.plugin.settings.mcqFolder}/${id}.md`;
	}

	private entryFor(id: string): IndexEntry | undefined {
		return this.plugin.index.get(this.pathFor(id));
	}

	private liveModules(): Set<string> {
		return this.plugin.schedule.live((id) => this.entryFor(id) !== undefined);
	}

	private renderModuleCrumbs(): void {
		const current = this.plugin.schedule.state?.current;
		const def = current ? this.plugin.schedule.byKey.get(current.key) : undefined;
		if (!this.studying || !current) {
			this.crumbEl.createSpan({ cls: "mcq-crumb is-current", text: "Modules" });
			return;
		}
		const home = this.crumbEl.createEl("button", { cls: "mcq-crumb", text: "Modules" });
		home.addEventListener("click", () => this.goModulesHome());
		this.crumbEl.createSpan({ cls: "mcq-crumb-sep", text: "›" });
		this.crumbEl.createSpan({ cls: "mcq-crumb is-current", text: def?.name ?? current.key });
	}

	/** Back to the list. A question not yet rated waits under Resume. */
	private goModulesHome(): void {
		this.leaveQuestion();
		this.studying = false;
		this.render();
	}

	/** The home card has nothing due until a learning module's time comes; redraw it then. */
	private wake(): void {
		if (this.wakeAt === null || this.mode !== "modules" || this.studying) return;
		if (Date.now() >= this.wakeAt) {
			this.wakeAt = null;
			this.renderList();
		}
	}

	private todayLine(t: TodayStats): string {
		return `Due ${pad4(t.due)} · Learning ${pad4(t.learning)} · New ${pad4(t.newLeft)}`;
	}

	/** Questions seen, interval and ease, for a row or the study card. */
	private cardMeta(card: ModuleCard, def: ModuleDef | undefined): string {
		const total = def?.ids.length ?? Object.keys(card.questions).length;
		const seen = def ? def.ids.filter((id) => card.questions[id]).length : total;
		if (card.state === "new") return `${total} question${total === 1 ? "" : "s"} · new`;
		const progress = `seen ${seen}/${total}`;
		if (card.state === "review") {
			return `every ${formatDays(card.ivl)} · ease ${Math.round(card.ease * 100)}% · ${progress}`;
		}
		return `${card.state} · ${progress}`;
	}

	private dueText(card: ModuleCard, now: number, today: number): string {
		if (card.state === "learning" || card.state === "relearning") {
			return card.due <= now ? "due now" : `due in ${formatWait(card.due - now)}`;
		}
		if (card.state !== "review") return "";
		if (card.due < today) return `overdue ${formatDays(today - card.due)}`;
		return card.due === today ? "due today" : `due in ${formatDays(card.due - today)}`;
	}

	private dayLabel(day: number): string {
		return new Date(dayStartMs(day, this.limits().dayStartHour)).toLocaleDateString(undefined, {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
	}

	private renderModules(): void {
		const store = this.plugin.schedule;
		if (store.defs.length === 0) {
			return this.renderEmpty(`No modules found in ${store.modulesPath}.`);
		}
		const state = store.state;
		if (!state) {
			const card = this.listEl.createDiv({ cls: "mcq-card" });
			card.createDiv({
				text: `${store.defs.length} modules in ${store.modulesPath}. They are introduced from the first to the last, ${this.plugin.settings.newPerDay} a day, and each comes back for review as spaced repetition decides.`,
			});
			const create = card.createEl("button", { cls: "mod-cta", text: "Create schedule" });
			create.addEventListener("click", () => store.set(createSchedule(store.defs)));
			return;
		}

		if (this.studying && state.current) return this.renderStudyInfo();

		this.renderPlacementBanner();
		this.renderToday();

		this.listEl.createDiv({
			cls: "mcq-mod-summary",
			text: `Completed ${pad4(store.completed())} · Introduced ${pad4(introducedCount(state))} / ${store.defs.length}`,
		});

		const tabs = this.listEl.createDiv({ cls: "mcq-mod-tabs" });
		for (const tab of ["queue", "learning", "completed"] as ModTab[]) {
			const b = tabs.createEl("button", {
				cls: "mcq-mod-tab",
				text: tab === "queue" ? "Queue" : tab === "learning" ? "Learning" : "Completed",
			});
			b.toggleClass("is-active", this.modTab === tab);
			b.addEventListener("click", () => {
				this.modTab = tab;
				this.renderList();
			});
		}
		this.renderModuleRows();
	}

	/** While studying, the list shows the day's counts and the module on screen. */
	private renderStudyInfo(): void {
		const store = this.plugin.schedule;
		const state = store.state!;
		const cur = state.current!;
		const def = store.byKey.get(cur.key);
		const card = state.cards[cur.key] ?? newCard();
		const t = todayStats(state, this.liveModules(), Date.now(), this.limits());
		this.listEl.createDiv({ cls: "mcq-mod-summary", text: this.todayLine(t) });
		const box = this.listEl.createDiv({ cls: "mcq-card" });
		box.createDiv({ cls: "mcq-card-kicker", text: KIND_LABEL[cur.kind] });
		box.createDiv({ cls: "mcq-card-title", text: def?.name ?? cur.key });
		box.createDiv({
			cls: "mcq-card-meta",
			text: `${def?.topicLabel ?? ""} · ${this.cardMeta(card, def)} · ${cur.id}`,
		});
	}

	/** New modules in the file wait here until you say where they go. */
	private renderPlacementBanner(): void {
		const store = this.plugin.schedule;
		const state = store.state;
		if (!state) return;
		const fresh = unplacedModules(state, store.defs);
		if (fresh.length === 0) return;

		const banner = this.listEl.createDiv({ cls: "mcq-card is-banner" });
		const noun = fresh.length === 1 ? "new module" : "new modules";
		banner.createDiv({ text: `${fresh.length} ${noun} in ${store.modulesPath}. Place them:` });
		const row = banner.createDiv({ cls: "mcq-card-actions" });
		const keys = fresh.map((d) => d.key);
		const place = (p: Placement) => {
			const now = store.state;
			if (now) store.set(placeModules(now, keys, p, store.defs));
		};
		const button = (text: string, onClick: () => void) =>
			row.createEl("button", { cls: "mcq-btn", text }).addEventListener("click", onClick);
		button("Next up", () => place({ where: "next" }));
		button("End of queue", () => place({ where: "end" }));
		button("In file order", () => place({ where: "file" }));
		button("After…", () => {
			const now = store.state;
			if (!now || now.queue.length === 0) return place({ where: "end" });
			new ModulePicker(this.app, now.queue.map((k) => store.byKey.get(k)).filter(isDef), (d) =>
				place({ where: "after", key: d.key }),
			).open();
		});
	}

	/** Today's counts and Study; Resume for a question left unrated; or done, with study ahead. */
	private renderToday(): void {
		const store = this.plugin.schedule;
		const state = store.state!;
		const card = this.listEl.createDiv({ cls: "mcq-card" });
		this.wakeAt = null;

		if (state.current) {
			const def = store.byKey.get(state.current.key);
			card.createDiv({ cls: "mcq-card-kicker", text: "Unfinished" });
			card.createDiv({ cls: "mcq-card-title", text: def?.name ?? state.current.key });
			card.createDiv({ cls: "mcq-card-meta", text: `${def?.topicLabel ?? ""} · ${state.current.id}` });
			const resume = card.createEl("button", { cls: "mod-cta", text: "Continue" });
			resume.addEventListener("click", () => void this.resumeCurrent());
			return;
		}

		const now = Date.now();
		const limits = this.limits();
		const live = this.liveModules();
		const t = todayStats(state, live, now, limits);
		const ahead = t.day > studyDay(now, limits.dayStartHour);
		const pick = nextModule(state, live, now, limits);
		card.createDiv({
			cls: "mcq-card-kicker",
			text: ahead ? `Studying ahead · ${this.dayLabel(t.day)}` : "Today",
		});
		const doneLine = `Done: ${pad4(t.reviewsDone)} reviews · ${pad4(t.newDone)} new`;

		if (!isDone(pick)) {
			card.createDiv({ cls: "mcq-card-title", text: this.todayLine(t) });
			card.createDiv({ cls: "mcq-card-meta", text: doneLine });
			const study = card.createEl("button", { cls: "mod-cta", text: "Study" });
			study.addEventListener("click", () => void this.serveNext());
			return;
		}

		card.createDiv({ cls: "mcq-card-title", text: "Done for today" });
		const next = pick.nextLearningAt;
		card.createDiv({
			cls: "mcq-card-meta",
			text: next === null ? doneLine : `${doneLine} · a learning module is due in ${formatWait(next - now)}`,
		});
		if (next !== null) this.wakeAt = next - LEARN_AHEAD_MS;
		const ahead2 = card.createEl("button", { cls: "mod-cta", text: "Start tomorrow's modules" });
		ahead2.addEventListener("click", () => {
			const s = store.state;
			if (!s) return;
			store.set(studyAhead(s, Date.now(), limits.dayStartHour));
			void this.serveNext();
		});
	}

	private renderModuleRows(): void {
		const store = this.plugin.schedule;
		const state = store.state!;
		const live = this.liveModules();
		const now = Date.now();
		const today = effectiveDay(state, now, this.limits().dayStartHour);
		const mature = (k: string) => isMature(state.cards[k], store.byKey.get(k)?.ids);
		const dueMs = (c: ModuleCard) =>
			c.state === "review" ? dayStartMs(c.due, this.limits().dayStartHour) : c.due;

		let keys: string[];
		if (this.modTab === "queue") {
			keys = state.queue.filter((k) => live.has(k));
		} else {
			const completed = this.modTab === "completed";
			keys = Object.entries(state.cards)
				.filter(([k, c]) => store.byKey.has(k) && c.state !== "new" && mature(k) === completed)
				.sort((a, b) => dueMs(a[1]) - dueMs(b[1]))
				.map(([k]) => k);
		}
		const defs = keys.map((k) => store.byKey.get(k)).filter(isDef);
		const matches = this.filter(defs, (d) => `${d.name} ${d.topicLabel}`);
		if (matches.length === 0) {
			return this.renderEmpty(
				this.modTab === "queue" ? "No modules waiting." : `No ${this.modTab} modules yet.`,
			);
		}

		const cap = this.plugin.settings.searchResultCap;
		for (const d of matches.slice(0, cap)) {
			const c = state.cards[d.key] ?? newCard();
			const row = this.listEl.createDiv({ cls: "mcq-row is-module" });
			const text = row.createDiv({ cls: "mcq-row-text" });
			text.createDiv({ cls: "mcq-row-label", text: d.name });
			text.createDiv({
				cls: "mcq-row-meta",
				text:
					this.modTab === "queue"
						? `${d.topicLabel} · ${d.ids.length}`
						: `${d.topicLabel} · ${this.dueText(c, now, today)} · ${this.cardMeta(c, d)}`,
			});
			const tools = row.createDiv({ cls: "mcq-row-tools" });
			const tool = (icon: string, label: string, onClick: () => void) => {
				const b = tools.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
				setIcon(b, icon);
				b.addEventListener("click", (e) => {
					e.stopPropagation();
					onClick();
				});
			};
			const move = (mv: Move) => () => {
				const s = store.state;
				if (s) store.set(moveInQueue(s, d.key, mv));
			};
			const reset = () => {
				const s = store.state;
				if (s) store.set(resetModule(s, d.key, store.defs));
			};
			if (this.modTab === "queue") {
				tool("arrow-up-to-line", "Move to top", move("top"));
				tool("arrow-up", "Move up", move("up"));
				tool("arrow-down", "Move down", move("down"));
				tool("arrow-down-to-line", "Move to bottom", move("bottom"));
			} else {
				tool("rotate-ccw", this.modTab === "completed" ? "Un-complete (back to the queue)" : "Reset (back to the queue)", reset);
			}
			if (this.modTab !== "completed") {
				const kind: PickKind = c.state === "new" ? "new" : c.state === "review" ? "review" : "learning";
				tool("play", "Study now", () => void this.serveModule(d.key, kind));
			}
		}
		if (matches.length > cap) {
			this.listEl.createDiv({
				cls: "mcq-list-footer",
				text: `Showing ${cap} of ${matches.length} — search to find others`,
			});
		}
	}

	/** The next module due, or back to the list when the day is done. */
	private async serveNext(): Promise<void> {
		const state = this.plugin.schedule.state;
		if (!state) return;
		const pick = nextModule(state, this.liveModules(), Date.now(), this.limits());
		if (isDone(pick)) return this.goModulesHome();
		await this.serveModule(pick.key, pick.kind);
	}

	/** Choose the module's next question — unseen TO, unseen OB, then its weakest — and open it. */
	private async serveModule(key: string, kind: PickKind): Promise<void> {
		const store = this.plugin.schedule;
		const def = store.byKey.get(key);
		if (!store.state || !def) return;

		const entries = def.ids.map((id) => this.entryFor(id)).filter((e): e is IndexEntry => !!e);
		// Parse them all, so questions the source never answered go last.
		await Promise.all(
			entries.map(async (e) => {
				if (this.previews.has(e.path)) return;
				const file = this.app.vault.getFileByPath(e.path);
				if (!(file instanceof TFile)) return;
				try {
					this.previews.set(e.path, parseMcq(e.path, await this.app.vault.cachedRead(file)));
				} catch {
					/* a note that breaks the syntax is simply not asked */
				}
			}),
		);
		const usable = entries.filter((e) => this.previews.has(e.path)).map((e) => e.id);
		const state = store.state;
		if (!state) return;
		const id = nextQuestion(
			state.cards[key],
			usable,
			{
				isTO: (q) => this.entryFor(q)?.family === "TO",
				answerable: (q) => this.previews.get(this.pathFor(q))?.correctIndex != null,
			},
			Math.random,
		);
		const entry = id ? this.entryFor(id) : undefined;
		if (!id || !entry) {
			new Notice(`None of the questions in “${def.name}” could be read.`);
			return;
		}
		store.set(setCurrent(state, { key, id, kind, revealed: null }));
		this.studying = true;
		this.resetSearch();
		this.renderCrumbs();
		await this.select(entry);
	}

	/** Reopen the question that was on screen, as it was left. */
	private async resumeCurrent(): Promise<void> {
		const store = this.plugin.schedule;
		const cur = store.state?.current;
		if (!store.state || !cur) return;
		const entry = this.entryFor(cur.id);
		if (!entry) {
			store.set(setCurrent(store.state, null));
			return this.serveNext();
		}
		this.studying = true;
		this.resetSearch();
		this.renderCrumbs();
		await this.select(entry);
	}

	/** Rate the module on screen, log the answer, and go straight to the next module. */
	private async rate(r: Rating): Promise<void> {
		const store = this.plugin.schedule;
		const state = store.state;
		const cur = state?.current;
		const mcq = this.current;
		if (!state || !cur || !mcq || cur.id !== mcq.id || this.answered === null || this.clock.isPaused()) return;
		const now = Date.now();
		const limits = this.limits();
		const chosen = this.answered === SKIPPED ? null : this.answered;
		const result = chosen === null || mcq.correctIndex === null ? 0 : chosen === mcq.correctIndex ? 1 : -1;
		store.logResponse({
			module: cur.key,
			id: cur.id,
			result,
			rating: r,
			day: effectiveDay(state, now, limits.dayStartHour),
		});
		store.set(rateModule(state, cur.key, cur.id, r, now, limits));
		await this.serveNext();
	}

	// --------------------------------------------------------------- search

	private filter<T>(items: T[], text: (item: T) => string): T[] {
		if (!this.query) return items;
		const search =
			items.length > 2000 ? prepareSimpleSearch(this.query) : prepareFuzzySearch(this.query);
		const scored: { item: T; score: number }[] = [];
		for (const item of items) {
			const result = search(text(item));
			if (result) scored.push({ item, score: result.score });
		}
		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => s.item);
	}

	/** Global question search. Only ids and topics — question text is not indexed. */
	private searchAll(): IndexEntry[] {
		const search = prepareSimpleSearch(this.query);
		const scored: { item: IndexEntry; score: number }[] = [];
		for (const entry of this.plugin.index.all()) {
			const hay = `${entry.id} ${entry.topic} ${SECTION_LABELS[entry.section]}`;
			const result = search(hay);
			if (result) scored.push({ item: entry, score: result.score });
		}
		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => s.item);
	}

	private onKeyDown(evt: KeyboardEvent): void {
		if (evt.target === this.searchEl) return;
		const mcq = this.current;

		if (evt.key === "Escape" && this.mode === "modules") {
			if (this.studying) this.goModulesHome();
			return;
		}
		if (evt.key === "Escape") {
			if (this.level === "questions") {
				this.level = "topics";
				this.topic = null;
			} else if (this.level === "topics") {
				this.level = "sections";
				this.section = null;
			}
			this.resetSearch();
			this.render();
			return;
		}

		if (!mcq) return;

		if (this.inStudy()) {
			// Space and Enter on a focused button already click it.
			if (evt.target instanceof HTMLButtonElement && (evt.key === " " || evt.key === "Enter")) return;
			if (evt.key === "c") {
				evt.preventDefault();
				if (this.clock.isPaused()) this.cont();
				else this.stop();
				return;
			}
			// Paused: nothing can be answered until Continue.
			if (this.clock.isPaused()) return;
			const r = RATING_KEYS[evt.key];
			if (r !== undefined) {
				evt.preventDefault();
				if (r === 0) this.skip();
				else if (this.answered !== null) void this.rate(r);
				return;
			}
		}

		if (evt.key === "n" || evt.key === "ArrowRight") {
			evt.preventDefault();
			void this.step(1);
			return;
		}
		if (evt.key === "p" || evt.key === "ArrowLeft") {
			evt.preventDefault();
			void this.step(-1);
			return;
		}
		if (evt.key === "s") {
			evt.preventDefault();
			this.skip();
			return;
		}

		const byLabel = mcq.options.findIndex((o) => o.label === evt.key);
		if (byLabel !== -1) {
			evt.preventDefault();
			this.answer(byLabel);
		}
	}
}

function isDef(d: ModuleDef | undefined): d is ModuleDef {
	return d !== undefined;
}

/** Pick the module that new modules should follow. */
class ModulePicker extends FuzzySuggestModal<ModuleDef> {
	constructor(
		app: App,
		private items: ModuleDef[],
		private onPick: (d: ModuleDef) => void,
	) {
		super(app);
		this.setPlaceholder("Place the new modules after…");
	}

	getItems(): ModuleDef[] {
		return this.items;
	}

	getItemText(d: ModuleDef): string {
		return `${d.name} — ${d.topicLabel}`;
	}

	onChooseItem(d: ModuleDef): void {
		this.onPick(d);
	}
}
