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
import { QUESTION_TIME_CAP_MS } from "./activity";
import { QuestionClock } from "./clock";
import { IndexEntry } from "./index";
import { parseMcq } from "./parser";
import type { ModuleDef } from "./modules";
import {
	createSchedule,
	completedCount,
	finishSession,
	moveInQueue,
	Move,
	nextModule,
	pickQuestions,
	Placement,
	placeModules,
	recordAnswer,
	resetModule,
	Result,
	SessionKind,
	sessionDone,
	solvedCount,
	startSession,
	Tally,
	unplacedModules,
} from "./schedule";
import { MCQ, Section, SECTION_LABELS } from "./types";

export const VIEW_TYPE_MCQ = "mcq-scheduler-browser";

type Level = "sections" | "topics" | "questions";
type Mode = "browse" | "modules";
type ModTab = "queue" | "solved" | "completed";

/** `answered` value for a skipped question: the answer is shown, nothing was chosen. */
const SKIPPED = -1;

function signed(n: number): string {
	return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2);
}

export class McqView extends ItemView {
	navigation = false;

	private mode: Mode = "browse";
	/** In Modules mode: working through the session's questions, rather than on the home list. */
	private sessionOpen = false;
	private modTab: ModTab = "queue";
	/** Shown in the quiz pane after a module is finished, until the next one starts. */
	private summary: { name: string; tally: Tally; completedNow: boolean } | null = null;
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
		this.sessionOpen = false;
		this.summary = null;
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
		// Every way of changing question — Next, Previous, keys, a row, a search
		// result — comes through here, so this one reset covers them all.
		this.clock.start();
		this.loggedMs = 0;
		// Before the note is opened, so the outgoing one re-hides without the
		// reveal being visible for a frame on the way out.
		this.plugin.reveal.clear();
		// A question already answered in the running module comes back as it
		// was left, so a resumed module shows what you chose.
		const prior = this.inSession() ? this.plugin.schedule.state?.current?.answers[entry.id] : undefined;
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
		this.clockEl = null;
		const mcq = this.current;
		if (!mcq) {
			if (this.mode === "modules" && this.summary) return this.renderSummary();
			this.quizEl.createDiv({
				cls: "mcq-quiz-empty",
				text: this.mode === "modules" ? "Start a module to begin." : "Pick a question to begin.",
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
		const session = this.inSession() ? this.plugin.schedule.state?.current : null;
		if (session && at && at.index >= at.total - 1) {
			// The last question of a module finishes it, once every question has an answer.
			next.setText("Finish ▸");
			next.disabled = !sessionDone(session);
		} else {
			next.disabled = at === null || at.index >= at.total - 1;
		}

		if (this.answered !== null) this.paintAnswer(this.answered);
	}

	private answer(index: number): void {
		const mcq = this.current;
		if (!mcq || this.answered !== null) return;
		this.answered = index;
		this.clock.markAnswered();
		this.tickClock();
		this.plugin.activity.recordSolved();
		this.logTime();
		const result: Result = mcq.correctIndex === null ? 0 : index === mcq.correctIndex ? 1 : -1;
		this.recordInSession(mcq.id, result, index);
		this.paintAnswer(index);
		// Any answer reveals, right or wrong: committing to an option is the
		// price of the explanation. The keyboard path lands here too.
		this.plugin.reveal.answer(mcq.path);
	}

	/** Show the answer without choosing. Scores 0 in a module; not counted as solved. */
	private skip(): void {
		const mcq = this.current;
		if (!mcq || this.answered !== null) return;
		this.answered = SKIPPED;
		this.clock.markAnswered();
		this.tickClock();
		this.logTime();
		this.paintAnswer(SKIPPED);
		this.plugin.reveal.answer(mcq.path);
		this.recordInSession(mcq.id, 0, null);
		this.quizEl.querySelectorAll<HTMLButtonElement>(".mcq-actions .mcq-btn").forEach((b) => {
			if (b.textContent === "Skip") b.disabled = true;
		});
	}

	private recordInSession(id: string, result: Result, chosen: number | null): void {
		const store = this.plugin.schedule;
		const state = store.state;
		if (!this.inSession() || !state?.current || !state.current.ids.includes(id)) return;
		if (state.current.answers[id]) return;
		store.set(recordAnswer(state, id, { result, chosen }));
		store.logResponse({ module: state.current.key, id, result, session: state.sessionCount + 1 });
		// The Finish button and the n/total crumb depend on what is answered.
		this.renderCrumbs();
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
		if (this.inSession()) {
			const entries = this.sessionEntries();
			const index = entries.findIndex((e) => e.path === this.currentPath);
			return index === -1 ? null : { entries, index, total: entries.length };
		}
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
			if (this.inSession()) return this.finishModule();
			new Notice("That was the last question in this topic.");
			return;
		}
		await this.select(at.entries[target]);
	}

	// -------------------------------------------------------------- modules

	private inSession(): boolean {
		return this.mode === "modules" && this.sessionOpen && !!this.plugin.schedule.state?.current;
	}

	private pathFor(id: string): string {
		return `${this.plugin.settings.mcqFolder}/${id}.md`;
	}

	private entryFor(id: string): IndexEntry | undefined {
		return this.plugin.index.get(this.pathFor(id));
	}

	private sessionEntries(): IndexEntry[] {
		const ids = this.plugin.schedule.state?.current?.ids ?? [];
		return ids.map((id) => this.entryFor(id)).filter((e): e is IndexEntry => e !== undefined);
	}

	private liveModules(): Set<string> {
		return this.plugin.schedule.live((id) => this.entryFor(id) !== undefined);
	}

	private renderModuleCrumbs(): void {
		const current = this.plugin.schedule.state?.current;
		const def = current ? this.plugin.schedule.byKey.get(current.key) : undefined;
		if (!this.sessionOpen || !current) {
			this.crumbEl.createSpan({ cls: "mcq-crumb is-current", text: "Modules" });
			return;
		}
		const home = this.crumbEl.createEl("button", { cls: "mcq-crumb", text: "Modules" });
		home.addEventListener("click", () => this.goModulesHome());
		this.crumbEl.createSpan({ cls: "mcq-crumb-sep", text: "›" });
		const done = Object.keys(current.answers).length;
		this.crumbEl.createSpan({
			cls: "mcq-crumb is-current",
			text: `${def?.name ?? current.key} · ${done}/${current.ids.length}`,
		});
	}

	private goModulesHome(): void {
		this.leaveQuestion();
		this.sessionOpen = false;
		this.render();
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
				text: `${store.defs.length} modules in ${store.modulesPath}. The schedule starts at the first and works to the last, every module at score 0 and 0 attempts.`,
			});
			const create = card.createEl("button", { cls: "mod-cta", text: "Create schedule" });
			create.addEventListener("click", () => store.set(createSchedule(store.defs)));
			return;
		}

		if (this.sessionOpen && state.current) return this.renderSessionRows();

		this.renderPlacementBanner();
		this.renderUpNext();

		this.listEl.createDiv({
			cls: "mcq-mod-summary",
			text: `Completed ${String(completedCount(state)).padStart(4, "0")} · Solved ${String(
				solvedCount(state),
			).padStart(4, "0")} / ${store.defs.length}`,
		});

		const tabs = this.listEl.createDiv({ cls: "mcq-mod-tabs" });
		for (const tab of ["queue", "solved", "completed"] as ModTab[]) {
			const b = tabs.createEl("button", {
				cls: "mcq-mod-tab",
				text: tab === "queue" ? "Queue" : tab === "solved" ? "Solved" : "Completed",
			});
			b.toggleClass("is-active", this.modTab === tab);
			b.addEventListener("click", () => {
				this.modTab = tab;
				this.renderList();
			});
		}
		this.renderModuleRows();
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

	private renderUpNext(): void {
		const store = this.plugin.schedule;
		const state = store.state!;
		const card = this.listEl.createDiv({ cls: "mcq-card" });

		if (state.current) {
			const def = store.byKey.get(state.current.key);
			const done = Object.keys(state.current.answers).length;
			card.createDiv({ cls: "mcq-card-kicker", text: "Unfinished" });
			card.createDiv({ cls: "mcq-card-title", text: def?.name ?? state.current.key });
			card.createDiv({
				cls: "mcq-card-meta",
				text: `${def?.topicLabel ?? ""} · ${done} of ${state.current.ids.length} answered`,
			});
			const resume = card.createEl("button", { cls: "mod-cta", text: "Resume" });
			resume.addEventListener("click", () => void this.resumeModule());
			return;
		}

		const pick = nextModule(state, this.liveModules());
		if (!pick) {
			card.createDiv({ cls: "mcq-card-title", text: "Every module is completed." });
			return;
		}
		const def = store.byKey.get(pick.key)!;
		const m = state.modules[pick.key];
		const n = def.ids.filter((id) => this.entryFor(id)).length;
		card.createDiv({
			cls: "mcq-card-kicker",
			text: pick.kind === "new" ? "Up next · New" : "Up next · Repeat",
		});
		card.createDiv({ cls: "mcq-card-title", text: def.name });
		const meta =
			pick.kind === "repeat" && m
				? `${def.topicLabel} · score ${signed(m.score)} · ${m.attempts}× · ★${m.perfect}`
				: `${def.topicLabel} · ${n} question${n === 1 ? "" : "s"}`;
		card.createDiv({ cls: "mcq-card-meta", text: meta });
		const start = card.createEl("button", { cls: "mod-cta", text: "Start" });
		start.addEventListener("click", () => void this.startModule(pick.key, pick.kind));
	}

	private renderModuleRows(): void {
		const store = this.plugin.schedule;
		const state = store.state!;
		const live = this.liveModules();

		let keys: string[];
		if (this.modTab === "queue") {
			keys = state.queue.filter((k) => live.has(k));
		} else {
			const completed = this.modTab === "completed";
			keys = Object.entries(state.modules)
				.filter(([k, m]) => store.byKey.has(k) && m.attempts > 0 && m.completed === completed)
				.sort((a, b) => a[1].score - b[1].score || a[1].attempts - b[1].attempts)
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
			const m = state.modules[d.key];
			const row = this.listEl.createDiv({ cls: "mcq-row is-module" });
			const text = row.createDiv({ cls: "mcq-row-text" });
			text.createDiv({ cls: "mcq-row-label", text: d.name });
			text.createDiv({
				cls: "mcq-row-meta",
				text:
					this.modTab === "queue" || !m
						? `${d.topicLabel} · ${d.ids.length}`
						: `${d.topicLabel} · ${signed(m.score)} · ${m.attempts}× · ★${m.perfect}`,
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
				const now = store.state;
				if (now) store.set(moveInQueue(now, d.key, mv));
			};
			const reset = () => {
				const now = store.state;
				if (now) store.set(resetModule(now, d.key, store.defs));
			};
			if (this.modTab === "queue") {
				tool("arrow-up-to-line", "Move to top", move("top"));
				tool("arrow-up", "Move up", move("up"));
				tool("arrow-down", "Move down", move("down"));
				tool("arrow-down-to-line", "Move to bottom", move("bottom"));
			} else {
				tool("rotate-ccw", this.modTab === "completed" ? "Un-complete (reset)" : "Reset", reset);
			}
			if (this.modTab !== "completed") {
				tool("play", "Start now", () => void this.startModule(d.key, "manual"));
			}
		}
		if (matches.length > cap) {
			this.listEl.createDiv({
				cls: "mcq-list-footer",
				text: `Showing ${cap} of ${matches.length} — search to find others`,
			});
		}
	}

	private renderSessionRows(): void {
		const current = this.plugin.schedule.state!.current!;
		current.ids.forEach((id, i) => {
			const entry = this.entryFor(id);
			const row = this.listEl.createDiv({ cls: "mcq-row is-question", attr: { tabindex: "0" } });
			row.toggleClass("is-active", entry?.path === this.currentPath);
			row.createSpan({ cls: "mcq-row-index", text: String(i + 1) });
			if (entry) {
				row.createSpan({ cls: `mcq-row-badge is-${entry.family.toLowerCase()}`, text: entry.family });
			}
			row.createSpan({ cls: "mcq-row-label", text: id });
			const a = current.answers[id];
			row.createSpan({
				cls: "mcq-row-meta",
				text: a === undefined ? "" : a.result === 1 ? "✓" : a.result === -1 ? "✗" : "–",
			});
			if (!entry) return;
			const open = () => void this.select(entry);
			row.addEventListener("click", open);
			row.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter") open();
			});
		});
	}

	/** Read a module's notes, pick 40% of them, and open the first. */
	private async startModule(key: string, kind: SessionKind): Promise<void> {
		const store = this.plugin.schedule;
		const state = store.state;
		const def = store.byKey.get(key);
		if (!state || !def) return;
		if (state.current && state.current.key !== key) {
			const name = store.byKey.get(state.current.key)?.name ?? state.current.key;
			new Notice(`Finish “${name}” first — it is waiting under Resume.`);
			return;
		}
		if (state.current) return this.resumeModule();

		const entries = def.ids.map((id) => this.entryFor(id)).filter((e): e is IndexEntry => !!e);
		if (entries.length === 0) {
			new Notice(`None of the questions in “${def.name}” are in the index.`);
			return;
		}
		// Parse them all, so questions the source never answered can be left out.
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
		if (usable.length === 0) {
			new Notice(`None of the questions in “${def.name}” could be read.`);
			return;
		}
		const ids = pickQuestions(
			usable,
			(id) => this.previews.get(this.pathFor(id))?.correctIndex != null,
			state.modules[key]?.lastIds ?? [],
			Math.random,
			(id) => this.entryFor(id)?.family === "TO",
		);
		store.set(startSession(state, key, kind, ids));
		this.summary = null;
		await this.resumeModule();
	}

	/** Open the running module at its first unanswered question. */
	private async resumeModule(): Promise<void> {
		const current = this.plugin.schedule.state?.current;
		if (!current) return;
		this.sessionOpen = true;
		this.resetSearch();
		const first = current.ids.find((id) => !current.answers[id]) ?? current.ids[0];
		const entry = this.entryFor(first) ?? this.sessionEntries()[0];
		this.renderCrumbs();
		if (entry) await this.select(entry);
		else this.render();
	}

	private finishModule(): void {
		const store = this.plugin.schedule;
		const state = store.state;
		if (!state?.current) return;
		if (!sessionDone(state.current)) {
			new Notice("Answer or skip every question first.");
			return;
		}
		const name = store.byKey.get(state.current.key)?.name ?? state.current.key;
		const done = finishSession(state);
		if (!done) return;
		this.leaveQuestion();
		this.sessionOpen = false;
		this.summary = { name, tally: done.tally, completedNow: done.completedNow };
		store.set(done.state);
		this.render();
	}

	private renderSummary(): void {
		const s = this.summary!;
		const card = this.quizEl.createDiv({ cls: "mcq-card mcq-summary" });
		card.createDiv({ cls: "mcq-card-kicker", text: "Module finished" });
		card.createDiv({ cls: "mcq-card-title", text: s.name });
		card.createDiv({
			cls: "mcq-card-meta",
			text: `Score ${signed(s.tally.average)} · ${s.tally.right} right · ${s.tally.skipped} skipped · ${s.tally.wrong} wrong`,
		});
		if (s.completedNow) card.createDiv({ cls: "mcq-summary-complete", text: "Completed!" });
		const actions = card.createDiv({ cls: "mcq-card-actions" });
		const next = actions.createEl("button", { cls: "mod-cta", text: "Next module" });
		next.addEventListener("click", () => {
			const state = this.plugin.schedule.state;
			const pick = state ? nextModule(state, this.liveModules()) : null;
			this.summary = null;
			if (pick) void this.startModule(pick.key, pick.kind);
			else this.render();
		});
		const back = actions.createEl("button", { cls: "mcq-btn", text: "Back" });
		back.addEventListener("click", () => {
			this.summary = null;
			this.render();
		});
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
			if (this.sessionOpen) this.goModulesHome();
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
