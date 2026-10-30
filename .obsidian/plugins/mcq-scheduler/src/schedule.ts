/**
 * The module schedule: Anki-style spaced repetition where the card is a module.
 *
 * Pure — no Obsidian import, time and randomness injected — so every rule
 * below is tested in test/schedule.test.ts.
 *
 * - Each visit to a module asks one question and is rated Skip, Hard, Good
 *   or Easy. The rating schedules the module with Anki's SM-2 defaults:
 *   learning steps of 1 and 10 minutes, then intervals in days.
 * - A visit asks a question not seen before — TO ones first, then OB — and,
 *   once all have been seen, the module's weakest question.
 * - New modules are introduced from the head of the queue, up to a daily
 *   limit, spread among the day's reviews.
 * - A module is completed (mature) once every question has been seen and its
 *   interval has reached 21 days. It stays scheduled.
 *
 * Every function returns a new state; nothing is mutated in place.
 */

import type { ModuleDef } from "./modules";

/** 0 Skip · 1 Hard · 2 Good · 3 Easy. */
export type Rating = 0 | 1 | 2 | 3;
export const RATING_LABELS = ["Skip", "Hard", "Good", "Easy"] as const;

export type CardState = "new" | "learning" | "review" | "relearning";
export type PickKind = "new" | "learning" | "review";

export interface QuestionStat {
	seen: number;
	/** The latest rating. */
	last: Rating;
	/** Sum of every rating, for the average. */
	sum: number;
	lastAt: number;
}

export interface ModuleCard {
	state: CardState;
	/** Index into the learning or relearning steps. */
	step: number;
	/** Learning and relearning: epoch ms. Review: study day number. New: 0. */
	due: number;
	/** Interval in days; 0 until the module graduates. */
	ivl: number;
	ease: number;
	reps: number;
	lapses: number;
	/** The question asked last, so the next visit asks another. */
	lastId: string | null;
	questions: Record<string, QuestionStat>;
}

/** The question on screen, kept so a closed pane resumes where it was. */
export interface Current {
	key: string;
	id: string;
	kind: PickKind;
	/** Set once an option is chosen (or Skip reveals the answer, chosen null). */
	revealed: { chosen: number | null } | null;
}

export interface DayCounts {
	day: number;
	newDone: number;
	reviewsDone: number;
}

export interface ScheduleState {
	version: 2;
	/** Modules not yet introduced, in the order they will be. Editable. */
	queue: string[];
	/** One card per scheduled module, introduced or not. */
	cards: Record<string, ModuleCard>;
	/** What was done on the study day `today.day`. */
	today: DayCounts;
	/** "Start tomorrow's modules": the study day the schedule acts as, if later than the real one. */
	aheadDay: number;
	current: Current | null;
}

export interface Limits {
	newPerDay: number;
	reviewsPerDay: number;
	/** Hour at which a new study day begins, 0–23. */
	dayStartHour: number;
}

export const DEFAULT_LIMITS: Limits = { newPerDay: 20, reviewsPerDay: 200, dayStartHour: 4 };

const MIN = 60_000;
const DAY_MS = 86_400_000;
export const LEARN_STEPS_MIN = [1, 10];
export const RELEARN_STEPS_MIN = [10];
export const GRADUATING_IVL = 1;
export const EASY_IVL = 4;
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
export const EASY_BONUS = 1.3;
export const HARD_FACTOR = 1.2;
export const MAX_IVL = 36_500;
/** A learning module due this soon is shown rather than ending the day. */
export const LEARN_AHEAD_MS = 20 * MIN;
export const MATURE_IVL = 21;

export function newCard(): ModuleCard {
	return {
		state: "new",
		step: 0,
		due: 0,
		ivl: 0,
		ease: START_EASE,
		reps: 0,
		lapses: 0,
		lastId: null,
		questions: {},
	};
}

// ------------------------------------------------------------------ days

/** The local calendar day of `now`, counting a day as starting at `startHour`. */
export function studyDay(now: number, startHour: number): number {
	const d = new Date(now - startHour * 3_600_000);
	return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Epoch ms at which study day `day` begins. */
export function dayStartMs(day: number, startHour: number): number {
	const d = new Date(day * DAY_MS);
	return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), startHour).getTime();
}

/** The study day the schedule acts as: the real one, or later after "Start tomorrow's modules". */
export function effectiveDay(state: ScheduleState, now: number, startHour: number): number {
	return Math.max(studyDay(now, startHour), state.aheadDay);
}

function countsFor(state: ScheduleState, day: number): DayCounts {
	return state.today.day === day ? state.today : { day, newDone: 0, reviewsDone: 0 };
}

// --------------------------------------------------------------- schedule

/** A fresh schedule: every module queued in file order, none introduced. */
export function createSchedule(defs: ModuleDef[]): ScheduleState {
	const cards: Record<string, ModuleCard> = {};
	for (const d of defs) cards[d.key] = newCard();
	return {
		version: 2,
		queue: defs.map((d) => d.key),
		cards,
		today: { day: 0, newDone: 0, reviewsDone: 0 },
		aheadDay: 0,
		current: null,
	};
}

/** The session-based schedule this replaced. */
interface ScheduleV1 {
	version: 1;
	queue: string[];
	modules: Record<string, { attempts: number }>;
}

/**
 * Bring an older saved schedule up to date. Version 1 kept sessions and
 * scores that have no SM-2 meaning, so every module starts new; the queue
 * order you set is kept, and modules it had solved go to the end.
 */
export function migrate(saved: unknown): ScheduleState | null {
	const s = saved as { version?: number } | null;
	if (!s || typeof s !== "object") return null;
	if (s.version === 2) return s as ScheduleState;
	if (s.version !== 1) return null;
	const v1 = s as ScheduleV1;
	const queued = new Set(v1.queue);
	const queue = [...v1.queue, ...Object.keys(v1.modules).filter((k) => !queued.has(k))];
	const cards: Record<string, ModuleCard> = {};
	for (const k of queue) cards[k] = newCard();
	return { version: 2, queue, cards, today: { day: 0, newDone: 0, reviewsDone: 0 }, aheadDay: 0, current: null };
}

// ------------------------------------------------------------------ SM-2

function hardDelayMin(steps: number[], step: number): number {
	if (step > 0) return steps[step];
	return steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5;
}

function capIvl(n: number): number {
	return Math.min(MAX_IVL, Math.max(1, Math.round(n)));
}

/**
 * One rating, Anki's SM-2 with default options.
 * `now` is epoch ms; `day` is the study day the rating counts on.
 */
export function rate(card: ModuleCard, rating: Rating, now: number, day: number): ModuleCard {
	const c: ModuleCard = { ...card, reps: card.reps + 1 };
	const state = c.state === "new" ? "learning" : c.state;

	if (state === "learning" || state === "relearning") {
		const steps = state === "learning" ? LEARN_STEPS_MIN : RELEARN_STEPS_MIN;
		const step = c.state === "new" ? 0 : Math.min(c.step, steps.length - 1);
		const graduate = (ivl: number): ModuleCard => ({ ...c, state: "review", step: 0, ivl, due: day + ivl });
		switch (rating) {
			case 0:
				return { ...c, state, step: 0, due: now + steps[0] * MIN };
			case 1:
				return { ...c, state, step, due: now + hardDelayMin(steps, step) * MIN };
			case 2:
				if (step + 1 < steps.length) return { ...c, state, step: step + 1, due: now + steps[step + 1] * MIN };
				return graduate(state === "learning" ? GRADUATING_IVL : Math.max(1, c.ivl));
			case 3:
				return graduate(state === "learning" ? EASY_IVL : capIvl(Math.max(1, c.ivl) + 1));
		}
	}

	// Review. Days late count for half (Good) or fully (Easy), as in Anki.
	const late = Math.max(0, day - c.due);
	switch (rating) {
		case 0:
			return {
				...c,
				state: "relearning",
				step: 0,
				lapses: c.lapses + 1,
				ease: Math.max(MIN_EASE, c.ease - 0.2),
				ivl: 1,
				due: now + RELEARN_STEPS_MIN[0] * MIN,
			};
		case 1: {
			const ivl = capIvl(Math.max(c.ivl + 1, c.ivl * HARD_FACTOR));
			return { ...c, ivl, ease: Math.max(MIN_EASE, c.ease - 0.15), due: day + ivl };
		}
		case 2: {
			const hard = capIvl(Math.max(c.ivl + 1, c.ivl * HARD_FACTOR));
			const ivl = capIvl(Math.max(hard + 1, (c.ivl + late / 2) * c.ease));
			return { ...c, ivl, due: day + ivl };
		}
		case 3: {
			const hard = capIvl(Math.max(c.ivl + 1, c.ivl * HARD_FACTOR));
			const good = capIvl(Math.max(hard + 1, (c.ivl + late / 2) * c.ease));
			const ivl = capIvl(Math.max(good + 1, (c.ivl + late) * c.ease * EASY_BONUS));
			return { ...c, ivl, ease: c.ease + 0.15, due: day + ivl };
		}
	}
}

/** Short text for a wait: `1m`, `6m`, `2h`, `4d`, `1.5mo`, `2y`. */
export function formatWait(ms: number): string {
	const m = Math.max(1, Math.round(ms / MIN));
	if (m < 60) return `${m}m`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h`;
	return formatDays(Math.round(m / 1440));
}

export function formatDays(d: number): string {
	if (d < 30) return `${d}d`;
	if (d < 365) return `${+(d / 30).toFixed(1)}mo`;
	return `${+(d / 365).toFixed(1)}y`;
}

/** What each of the four buttons would schedule, as button captions. */
export function previewIntervals(card: ModuleCard, now: number, day: number): string[] {
	return ([0, 1, 2, 3] as Rating[]).map((r) => {
		const next = rate(card, r, now, day);
		return next.state === "review" ? formatDays(next.ivl) : formatWait(next.due - now);
	});
}

// ---------------------------------------------------------- what's next

export interface Pick {
	key: string;
	kind: PickKind;
}

export interface Done {
	done: true;
	/** When the next learning module falls due, if any is waiting. */
	nextLearningAt: number | null;
}

function isLearning(c: ModuleCard): boolean {
	return c.state === "learning" || c.state === "relearning";
}

function learningCards(state: ScheduleState, live: Set<string>): [string, ModuleCard][] {
	return Object.entries(state.cards)
		.filter(([k, c]) => live.has(k) && isLearning(c))
		.sort((a, b) => a[1].due - b[1].due);
}

function dueReviews(state: ScheduleState, live: Set<string>, day: number): [string, ModuleCard][] {
	return Object.entries(state.cards)
		.filter(([k, c]) => live.has(k) && c.state === "review" && c.due <= day)
		.sort((a, b) => a[1].due - b[1].due || a[1].ease - b[1].ease);
}

/** The first `n` queued modules that can be introduced. */
function newHeads(state: ScheduleState, live: Set<string>, n: number): string[] {
	const out: string[] = [];
	for (const k of state.queue) {
		if (out.length >= n) break;
		if (live.has(k) && (state.cards[k]?.state ?? "new") === "new") out.push(k);
	}
	return out;
}

export interface TodayStats {
	day: number;
	/** Reviews due today, within the daily review limit. */
	due: number;
	/** Modules in learning or relearning, due now or later. */
	learning: number;
	/** New modules still to introduce today. */
	newLeft: number;
	newDone: number;
	reviewsDone: number;
}

export function todayStats(state: ScheduleState, live: Set<string>, now: number, limits: Limits): TodayStats {
	const day = effectiveDay(state, now, limits.dayStartHour);
	const counts = countsFor(state, day);
	const reviewsLeft = Math.max(0, limits.reviewsPerDay - counts.reviewsDone);
	const newLeft = Math.max(0, limits.newPerDay - counts.newDone);
	return {
		day,
		due: Math.min(reviewsLeft, dueReviews(state, live, day).length),
		learning: learningCards(state, live).length,
		newLeft: newHeads(state, live, newLeft).length,
		newDone: counts.newDone,
		reviewsDone: counts.reviewsDone,
	};
}

/**
 * The module to show next, or done for the day.
 *
 * 1. A learning module that is due now.
 * 2. Due reviews and new modules, the new ones spread evenly among the
 *    reviews, each within its daily limit.
 * 3. A learning module due within {@link LEARN_AHEAD_MS}.
 */
export function nextModule(state: ScheduleState, live: Set<string>, now: number, limits: Limits): Pick | Done {
	const day = effectiveDay(state, now, limits.dayStartHour);
	const counts = countsFor(state, day);

	const learning = learningCards(state, live);
	if (learning.length && learning[0][1].due <= now) return { key: learning[0][0], kind: "learning" };

	const reviews = dueReviews(state, live, day).slice(0, Math.max(0, limits.reviewsPerDay - counts.reviewsDone));
	const fresh = newHeads(state, live, Math.max(0, limits.newPerDay - counts.newDone));
	if (reviews.length && fresh.length) {
		// Introduce a new module whenever new ones are no further along than reviews.
		const newShare = counts.newDone / (counts.newDone + fresh.length);
		const reviewShare = counts.reviewsDone / (counts.reviewsDone + reviews.length);
		return newShare <= reviewShare ? { key: fresh[0], kind: "new" } : { key: reviews[0][0], kind: "review" };
	}
	if (reviews.length) return { key: reviews[0][0], kind: "review" };
	if (fresh.length) return { key: fresh[0], kind: "new" };

	if (learning.length && learning[0][1].due <= now + LEARN_AHEAD_MS) {
		return { key: learning[0][0], kind: "learning" };
	}
	return { done: true, nextLearningAt: learning.length ? learning[0][1].due : null };
}

export function isDone(p: Pick | Done): p is Done {
	return "done" in p;
}

/** Shuffle with an injected rng in [0, 1) (Fisher–Yates). */
export function shuffle<T>(items: T[], rng: () => number): T[] {
	const a = items.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export interface QuestionKinds {
	isTO: (id: string) => boolean;
	/** False for questions the source never answered. */
	answerable: (id: string) => boolean;
}

/**
 * The question a visit asks. Unseen first — TO, then OB, then those the
 * source never answered — so every question comes up once before any repeats.
 * After that, the weakest: lowest last rating, then lowest average, then the
 * longest since seen, and never the one asked last time while another exists.
 */
export function nextQuestion(
	card: ModuleCard | undefined,
	ids: string[],
	kinds: QuestionKinds,
	rng: () => number,
): string | null {
	if (ids.length === 0) return null;
	const stats = card?.questions ?? {};
	const unseen = ids.filter((id) => !stats[id]);
	const groups = [
		unseen.filter((id) => kinds.answerable(id) && kinds.isTO(id)),
		unseen.filter((id) => kinds.answerable(id) && !kinds.isTO(id)),
		unseen.filter((id) => !kinds.answerable(id)),
	];
	for (const g of groups) if (g.length) return shuffle(g, rng)[0];

	const pool = ids.length > 1 ? ids.filter((id) => id !== card?.lastId) : ids;
	const avg = (s: QuestionStat) => s.sum / s.seen;
	return pool
		.slice()
		.sort((a, b) => {
			const x = stats[a];
			const y = stats[b];
			return x.last - y.last || avg(x) - avg(y) || x.lastAt - y.lastAt;
		})[0];
}

// --------------------------------------------------------------- actions

/** Put a question on screen. */
export function setCurrent(state: ScheduleState, current: Current | null): ScheduleState {
	return { ...state, current };
}

/** The answer to the question on screen was shown: an option chosen, or null for Skip. */
export function reveal(state: ScheduleState, chosen: number | null): ScheduleState {
	if (!state.current || state.current.revealed) return state;
	return { ...state, current: { ...state.current, revealed: { chosen } } };
}

/** Rate one visit: schedule the module, record the question, count it for the day. */
export function answer(
	state: ScheduleState,
	key: string,
	id: string,
	rating: Rating,
	now: number,
	limits: Limits,
): ScheduleState {
	const day = effectiveDay(state, now, limits.dayStartHour);
	const counts = countsFor(state, day);
	const before = state.cards[key] ?? newCard();
	const q = before.questions[id];
	const after: ModuleCard = {
		...rate(before, rating, now, day),
		lastId: id,
		questions: {
			...before.questions,
			[id]: { seen: (q?.seen ?? 0) + 1, last: rating, sum: (q?.sum ?? 0) + rating, lastAt: now },
		},
	};
	return {
		...state,
		queue: before.state === "new" ? state.queue.filter((k) => k !== key) : state.queue,
		cards: { ...state.cards, [key]: after },
		today: {
			day,
			newDone: counts.newDone + (before.state === "new" ? 1 : 0),
			reviewsDone: counts.reviewsDone + (before.state === "review" ? 1 : 0),
		},
		current: null,
	};
}

/** "Start tomorrow's modules": act as the next study day, with its reviews and new modules. */
export function studyAhead(state: ScheduleState, now: number, startHour: number): ScheduleState {
	return { ...state, aheadDay: effectiveDay(state, now, startHour) + 1 };
}

// ---------------------------------------------------------------- editing

export type Move = "up" | "down" | "top" | "bottom";

export function moveInQueue(state: ScheduleState, key: string, move: Move): ScheduleState {
	const q = state.queue.slice();
	const i = q.indexOf(key);
	if (i === -1) return state;
	q.splice(i, 1);
	const to =
		move === "top" ? 0 : move === "bottom" ? q.length : move === "up" ? Math.max(0, i - 1) : Math.min(q.length, i + 1);
	q.splice(to, 0, key);
	return { ...state, queue: q };
}

/** Insert `keys` into the queue where each falls in file order among the queued modules. */
function insertInFileOrder(queue: string[], keys: string[], order: Map<string, number>): string[] {
	const q = queue.slice();
	const sorted = keys.slice().sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	for (const k of sorted) {
		const pos = order.get(k) ?? Infinity;
		const at = q.findIndex((other) => (order.get(other) ?? Infinity) > pos);
		if (at === -1) q.push(k);
		else q.splice(at, 0, k);
	}
	return q;
}

/** Forget a module and put it back in the queue at its file position. */
export function resetModule(state: ScheduleState, key: string, defs: ModuleDef[]): ScheduleState {
	const order = new Map(defs.map((d) => [d.key, d.order]));
	const queue = insertInFileOrder(
		state.queue.filter((k) => k !== key),
		[key],
		order,
	);
	const current = state.current?.key === key ? null : state.current;
	return { ...state, queue, cards: { ...state.cards, [key]: newCard() }, current };
}

/** Modules in the file that the schedule has never seen. */
export function unplacedModules(state: ScheduleState, defs: ModuleDef[]): ModuleDef[] {
	return defs.filter((d) => !state.cards[d.key]);
}

export type Placement =
	| { where: "next" }
	| { where: "end" }
	| { where: "file" }
	| { where: "after"; key: string };

export function placeModules(
	state: ScheduleState,
	keys: string[],
	placement: Placement,
	defs: ModuleDef[],
): ScheduleState {
	const fresh = keys.filter((k) => !state.cards[k]);
	if (fresh.length === 0) return state;
	const order = new Map(defs.map((d) => [d.key, d.order]));
	const inFile = fresh.slice().sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

	let queue: string[];
	switch (placement.where) {
		case "next":
			queue = [...inFile, ...state.queue];
			break;
		case "end":
			queue = [...state.queue, ...inFile];
			break;
		case "file":
			queue = insertInFileOrder(state.queue, inFile, order);
			break;
		case "after": {
			const i = state.queue.indexOf(placement.key);
			queue =
				i === -1
					? [...inFile, ...state.queue]
					: [...state.queue.slice(0, i + 1), ...inFile, ...state.queue.slice(i + 1)];
			break;
		}
	}
	const cards = { ...state.cards };
	for (const k of fresh) cards[k] = newCard();
	return { ...state, queue, cards };
}

// ----------------------------------------------------------------- counts

/**
 * Mature: in review with an interval of 21 days or more, every question seen.
 * `ids` is the module's questions, or undefined if it has left the file.
 */
export function isMature(card: ModuleCard, ids: string[] | undefined): boolean {
	return card.state === "review" && card.ivl >= MATURE_IVL && (ids ?? []).every((id) => card.questions[id]);
}

export function completedCount(
	state: ScheduleState | null,
	idsOf: (key: string) => string[] | undefined,
): number {
	if (!state) return 0;
	// A module that has left the modules file is hidden, not completed.
	return Object.entries(state.cards).filter(([k, c]) => {
		const ids = idsOf(k);
		return ids !== undefined && isMature(c, ids);
	}).length;
}

/** Modules introduced so far. */
export function introducedCount(state: ScheduleState | null): number {
	if (!state) return 0;
	return Object.values(state.cards).filter((c) => c.state !== "new").length;
}
