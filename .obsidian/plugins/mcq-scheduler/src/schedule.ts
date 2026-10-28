/**
 * The module schedule: which module comes next, and what solving one does.
 *
 * Pure — no Obsidian import, randomness injected — so every rule below is
 * tested in test/schedule.test.ts.
 *
 * - Three new modules, then one repeat. The repeat is the lowest-scoring
 *   solved module that has waited its gap (see {@link gapFor}).
 * - A session asks every TO question in the module plus a random 40% of
 *   its OB questions (at least one), OB ones not asked last time first. +1 right, 0 skipped, −1 wrong; the
 *   module's score is that session's average.
 * - Three perfect sessions, in any order, complete a module.
 *
 * Every function returns a new state; nothing is mutated in place.
 */

import type { ModuleDef } from "./modules";

export type Result = -1 | 0 | 1;
export type SessionKind = "new" | "repeat" | "manual";

export interface ModuleState {
	attempts: number;
	/** Latest session average, −1…+1. 0 before the first attempt. */
	score: number;
	/** Perfect (+1) sessions so far; three complete the module. */
	perfect: number;
	completed: boolean;
	/** `sessionCount` right after this module was last solved; null if never. */
	lastSolvedAt: number | null;
	history: number[];
	/** Ids asked in the last session, so the next one prefers others. */
	lastIds: string[];
}

export interface SessionAnswer {
	result: Result;
	/** Option index chosen, or null for a skip — kept so a resumed question repaints. */
	chosen: number | null;
}

export interface Session {
	key: string;
	kind: SessionKind;
	ids: string[];
	answers: Record<string, SessionAnswer>;
}

export interface ScheduleState {
	version: 1;
	/** Unsolved modules, in the order they will be served. Editable. */
	queue: string[];
	/** One record per scheduled module, solved or not. */
	modules: Record<string, ModuleState>;
	/** Modules solved so far (sessions finished). */
	sessionCount: number;
	/** New modules served since the last repeat; at 3, a repeat is due. */
	slot: number;
	current: Session | null;
}

export const PICK_FRACTION = 0.4;
export const NEW_PER_REPEAT = 3;
export const PERFECT_TO_COMPLETE = 3;

export function emptyModule(): ModuleState {
	return {
		attempts: 0,
		score: 0,
		perfect: 0,
		completed: false,
		lastSolvedAt: null,
		history: [],
		lastIds: [],
	};
}

/** A fresh schedule: every module queued in file order, all at zero. */
export function createSchedule(defs: ModuleDef[]): ScheduleState {
	const modules: Record<string, ModuleState> = {};
	for (const d of defs) modules[d.key] = emptyModule();
	return {
		version: 1,
		queue: defs.map((d) => d.key),
		modules,
		sessionCount: 0,
		slot: 0,
		current: null,
	};
}

/**
 * Modules solved since `m` was last seen before it may repeat. Low scores
 * and few attempts come back soon; −1 always after 2, 0 after one attempt
 * after 4, +1 after two attempts after 10.
 */
export function gapFor(m: ModuleState): number {
	return 2 + 2 * m.attempts * (m.score + 1);
}

function waited(state: ScheduleState, m: ModuleState): number {
	return m.lastSolvedAt === null ? Infinity : state.sessionCount - m.lastSolvedAt;
}

/** Lowest score, then fewest attempts, then longest wait. */
function byNeed(state: ScheduleState) {
	return (a: [string, ModuleState], b: [string, ModuleState]) =>
		a[1].score - b[1].score ||
		a[1].attempts - b[1].attempts ||
		waited(state, b[1]) - waited(state, a[1]);
}

function repeatCandidates(
	state: ScheduleState,
	live: Set<string>,
	ignoreGap: boolean,
): [string, ModuleState][] {
	return Object.entries(state.modules)
		.filter(([k, m]) => live.has(k) && m.attempts > 0 && !m.completed)
		.filter(([, m]) => ignoreGap || waited(state, m) >= gapFor(m))
		.sort(byNeed(state));
}

export interface Pick {
	key: string;
	kind: Exclude<SessionKind, "manual">;
}

/**
 * The module to serve next, or null once everything is completed.
 * `live` is the set of modules that still exist in the file with questions.
 */
export function nextModule(state: ScheduleState, live: Set<string>): Pick | null {
	const head = state.queue.find((k) => live.has(k));

	if (state.slot >= NEW_PER_REPEAT || head === undefined) {
		const due = repeatCandidates(state, live, false);
		if (due.length) return { key: due[0][0], kind: "repeat" };
	}
	if (head !== undefined) return { key: head, kind: "new" };

	// Nothing new left: every slot repeats, gap relaxed — but not the module
	// just solved while any other remains.
	const any = repeatCandidates(state, live, true);
	if (any.length === 0) return null;
	const notJust = any.find(([, m]) => m.lastSolvedAt !== state.sessionCount);
	return { key: (notJust ?? any[0])[0], kind: "repeat" };
}

/** Fisher–Yates with an injected rng in [0, 1). */
export function shuffle<T>(items: T[], rng: () => number): T[] {
	const a = items.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function pickSize(poolSize: number): number {
	return poolSize === 0 ? 0 : Math.max(1, Math.ceil(PICK_FRACTION * poolSize));
}

/**
 * The questions for one session.
 *
 * Questions for which `always` is true (the TO questions) are all asked,
 * every session. The rest (OB) are sampled: 40% of them, rounded up, at
 * least one, those not asked last time first. The two are shuffled together.
 *
 * Questions the source never answered are left out unless there is nothing
 * else: they can only ever score 0, so one in every session would stop the
 * module from ever reaching +1.
 */
export function pickQuestions(
	ids: string[],
	answerable: (id: string) => boolean,
	lastIds: string[],
	rng: () => number,
	always: (id: string) => boolean = () => false,
): string[] {
	const good = ids.filter(answerable);
	const pool = good.length ? good : ids;
	const fixed = pool.filter(always);
	const sampled = pool.filter((id) => !always(id));

	const last = new Set(lastIds);
	const fresh = shuffle(
		sampled.filter((id) => !last.has(id)),
		rng,
	);
	const seen = shuffle(
		sampled.filter((id) => last.has(id)),
		rng,
	);
	const picked = [...fresh, ...seen].slice(0, pickSize(sampled.length));
	return shuffle([...fixed, ...picked], rng);
}

export function startSession(
	state: ScheduleState,
	key: string,
	kind: SessionKind,
	ids: string[],
): ScheduleState {
	const modules = state.modules[key] ? state.modules : { ...state.modules, [key]: emptyModule() };
	return { ...state, modules, current: { key, kind, ids, answers: {} } };
}

/** Record one answer in the running session. The first answer to a question stands. */
export function recordAnswer(
	state: ScheduleState,
	id: string,
	answer: SessionAnswer,
): ScheduleState {
	const cur = state.current;
	if (!cur || !cur.ids.includes(id) || cur.answers[id]) return state;
	return { ...state, current: { ...cur, answers: { ...cur.answers, [id]: answer } } };
}

export function sessionDone(s: Session): boolean {
	return s.ids.every((id) => s.answers[id] !== undefined);
}

export interface Tally {
	right: number;
	skipped: number;
	wrong: number;
	average: number;
}

export function tally(s: Session): Tally {
	let right = 0;
	let skipped = 0;
	let wrong = 0;
	for (const id of s.ids) {
		const r = s.answers[id]?.result;
		if (r === 1) right++;
		else if (r === -1) wrong++;
		else skipped++;
	}
	const n = s.ids.length || 1;
	return { right, skipped, wrong, average: (right - wrong) / n };
}

export interface Finished {
	state: ScheduleState;
	tally: Tally;
	completedNow: boolean;
}

/** Close the running session and fold its average into the module. */
export function finishSession(state: ScheduleState): Finished | null {
	const cur = state.current;
	if (!cur || !sessionDone(cur)) return null;

	const t = tally(cur);
	const before = state.modules[cur.key] ?? emptyModule();
	const sessionCount = state.sessionCount + 1;
	const perfect = before.perfect + (t.average === 1 ? 1 : 0);
	const completed = before.completed || perfect >= PERFECT_TO_COMPLETE;
	const after: ModuleState = {
		attempts: before.attempts + 1,
		score: t.average,
		perfect,
		completed,
		lastSolvedAt: sessionCount,
		history: [...before.history, t.average],
		lastIds: cur.ids,
	};

	// A repeat resets the cycle; a new module moves it on. A module started
	// out of turn leaves the cycle where it was.
	let slot = state.slot;
	if (cur.kind === "repeat") slot = 0;
	else if (cur.kind === "new") slot = Math.min(slot + 1, NEW_PER_REPEAT);

	return {
		state: {
			...state,
			queue: state.queue.filter((k) => k !== cur.key),
			modules: { ...state.modules, [cur.key]: after },
			sessionCount,
			slot,
			current: null,
		},
		tally: t,
		completedNow: completed && !before.completed,
	};
}

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

/** Zero a module and put it back in the queue at its file position. Also un-completes it. */
export function resetModule(state: ScheduleState, key: string, defs: ModuleDef[]): ScheduleState {
	const order = new Map(defs.map((d) => [d.key, d.order]));
	const queue = insertInFileOrder(
		state.queue.filter((k) => k !== key),
		[key],
		order,
	);
	const current = state.current?.key === key ? null : state.current;
	return { ...state, queue, modules: { ...state.modules, [key]: emptyModule() }, current };
}

/** Modules in the file that the schedule has never seen. */
export function unplacedModules(state: ScheduleState, defs: ModuleDef[]): ModuleDef[] {
	return defs.filter((d) => !state.modules[d.key]);
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
	const fresh = keys.filter((k) => !state.modules[k]);
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
	const modules = { ...state.modules };
	for (const k of fresh) modules[k] = emptyModule();
	return { ...state, queue, modules };
}

export function completedCount(state: ScheduleState | null): number {
	if (!state) return 0;
	return Object.values(state.modules).filter((m) => m.completed).length;
}

export function solvedCount(state: ScheduleState | null): number {
	if (!state) return 0;
	return Object.values(state.modules).filter((m) => m.attempts > 0).length;
}
