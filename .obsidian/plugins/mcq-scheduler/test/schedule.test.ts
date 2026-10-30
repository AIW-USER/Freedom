import { describe, expect, it } from "vitest";

import type { ModuleDef } from "../src/modules";
import {
	answer,
	completedCount,
	createSchedule,
	dayStartMs,
	DEFAULT_LIMITS,
	effectiveDay,
	formatWait,
	isDone,
	isMature,
	Limits,
	migrate,
	ModuleCard,
	moveInQueue,
	newCard,
	nextModule,
	nextQuestion,
	Pick,
	placeModules,
	previewIntervals,
	rate,
	Rating,
	resetModule,
	reveal,
	ScheduleState,
	setCurrent,
	studyAhead,
	studyDay,
	todayStats,
	unplacedModules,
} from "../src/schedule";

const MIN = 60_000;
/** Tue 6 Oct 2026, 10:00 local. */
const T0 = new Date(2026, 9, 6, 10, 0).getTime();
const H = DEFAULT_LIMITS.dayStartHour;
const D0 = studyDay(T0, H);

function defsOf(n: number, size = 5): ModuleDef[] {
	return Array.from({ length: n }, (_, i) => ({
		key: `t::m${i}`,
		section: "S",
		topicSlug: "t",
		topicLabel: "T",
		name: `m${i}`,
		ids: Array.from({ length: size }, (_, j) => `Q${i}_${j}`),
		order: i,
	}));
}

/** Deterministic rng (mulberry32). */
function seeded(seed = 1): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const allLive = (defs: ModuleDef[]) => new Set(defs.map((d) => d.key));

function review(ivl: number, ease = 2.5, due = D0): ModuleCard {
	return { ...newCard(), state: "review", ivl, ease, due, reps: 3 };
}

function pick(s: ScheduleState, live: Set<string>, now = T0, limits: Limits = DEFAULT_LIMITS): Pick {
	const p = nextModule(s, live, now, limits);
	if (isDone(p)) throw new Error("expected a module, got done");
	return p;
}

/** Serve and rate modules until the day is done; returns the order served. */
function studyDayOut(s: ScheduleState, live: Set<string>, rating: Rating, now: number, limits = DEFAULT_LIMITS) {
	const served: Pick[] = [];
	for (let i = 0; i < 1000; i++) {
		const p = nextModule(s, live, now, limits);
		if (isDone(p)) break;
		served.push(p);
		s = answer(s, p.key, `${p.key}#${i}`, rating, now, limits);
	}
	return { state: s, served };
}

describe("SM-2", () => {
	it("steps a new module through 1 m and 10 m, then graduates at 1 day", () => {
		let c = rate(newCard(), 2, T0, D0);
		expect(c.state).toBe("learning");
		expect(c.due).toBe(T0 + 10 * MIN);
		c = rate(c, 2, T0, D0);
		expect(c).toMatchObject({ state: "review", ivl: 1, due: D0 + 1 });
	});

	it("Easy graduates a new module at 4 days; Skip restarts at 1 minute; Hard waits between the steps", () => {
		expect(rate(newCard(), 3, T0, D0)).toMatchObject({ state: "review", ivl: 4, due: D0 + 4 });
		expect(rate(newCard(), 0, T0, D0)).toMatchObject({ state: "learning", step: 0, due: T0 + MIN });
		expect(rate(newCard(), 1, T0, D0).due).toBe(T0 + 5.5 * MIN);
	});

	it("Good on a review multiplies the interval by the ease", () => {
		expect(rate(review(10), 2, T0, D0)).toMatchObject({ ivl: 25, due: D0 + 25, ease: 2.5 });
	});

	it("Hard multiplies by 1.2 and lowers the ease by 15 points", () => {
		const c = rate(review(10), 1, T0, D0);
		expect(c.ivl).toBe(12);
		expect(c.ease).toBeCloseTo(2.35);
	});

	it("Easy multiplies by ease × 1.3 and raises the ease by 15 points", () => {
		const c = rate(review(10), 3, T0, D0);
		expect(c.ivl).toBe(33);
		expect(c.ease).toBeCloseTo(2.65);
	});

	it("Skip on a review is a lapse: relearn in 10 minutes, ease −20, never below 130%", () => {
		const c = rate(review(30, 1.4), 0, T0, D0);
		expect(c).toMatchObject({ state: "relearning", lapses: 1, ease: 1.3, ivl: 1, due: T0 + 10 * MIN });
		expect(rate(c, 2, T0, D0)).toMatchObject({ state: "review", ivl: 1, due: D0 + 1 });
	});

	it("counts days late, half for Good", () => {
		expect(rate(review(10, 2.5, D0 - 4), 2, T0, D0).ivl).toBe(30);
	});

	it("previews each button's wait", () => {
		expect(previewIntervals(newCard(), T0, D0)).toEqual(["1m", "6m", "10m", "4d"]);
		expect(previewIntervals(review(10), T0, D0)).toEqual(["10m", "12d", "25d", "1.1mo"]);
		expect(formatWait(3 * 60 * MIN)).toBe("3h");
	});
});

describe("study day", () => {
	it("counts 03:00 as the day before when the day starts at 4", () => {
		const late = new Date(2026, 9, 7, 3, 0).getTime();
		const morning = new Date(2026, 9, 7, 4, 0).getTime();
		expect(studyDay(late, 4)).toBe(D0);
		expect(studyDay(morning, 4)).toBe(D0 + 1);
		expect(dayStartMs(D0 + 1, 4)).toBe(morning);
	});

	it("study ahead acts as tomorrow, then carries on when tomorrow comes", () => {
		const defs = defsOf(50);
		const live = allLive(defs);
		const limits = { ...DEFAULT_LIMITS, newPerDay: 3 };
		let { state } = studyDayOut(createSchedule(defs), live, 3, T0, limits);
		expect(state.today).toMatchObject({ day: D0, newDone: 3 });

		state = studyAhead(state, T0, H);
		expect(effectiveDay(state, T0, H)).toBe(D0 + 1);
		expect(todayStats(state, live, T0, limits).newLeft).toBe(3);
		state = studyDayOut(state, live, 3, T0, limits).state;
		expect(state.today).toMatchObject({ day: D0 + 1, newDone: 3 });

		// The real tomorrow: still day D0+1, already done.
		const tomorrow = T0 + 86_400_000;
		expect(effectiveDay(state, tomorrow, H)).toBe(D0 + 1);
		expect(isDone(nextModule(state, live, tomorrow, limits))).toBe(true);
		// The day after: a fresh day.
		expect(todayStats(state, live, tomorrow + 86_400_000, limits).newLeft).toBe(3);
	});
});

describe("what comes next", () => {
	it("introduces new modules from the head of the queue, up to the daily limit", () => {
		const defs = defsOf(30);
		const { served } = studyDayOut(createSchedule(defs), allLive(defs), 3, T0);
		expect(served.map((p) => p.key)).toEqual(defs.slice(0, 20).map((d) => d.key));
		expect(served.every((p) => p.kind === "new")).toBe(true);
	});

	it("serves a due learning module first", () => {
		const defs = defsOf(5);
		let s = createSchedule(defs);
		s = answer(s, "t::m3", "x", 0, T0, DEFAULT_LIMITS); // learning, due T0+1m
		expect(pick(s, allLive(defs), T0 + 2 * MIN)).toEqual({ key: "t::m3", kind: "learning" });
	});

	it("spreads new modules evenly among the reviews", () => {
		const defs = defsOf(20);
		let s = createSchedule(defs);
		for (const d of defs.slice(10)) s = { ...s, cards: { ...s.cards, [d.key]: review(5) } };
		s = { ...s, queue: s.queue.slice(0, 10) };
		const { served } = studyDayOut(s, allLive(defs), 3, T0, { ...DEFAULT_LIMITS, newPerDay: 5 });
		expect(served.map((p) => p.kind[0]).join("")).toBe("nrrnrrnrrnrrnrr");
	});

	it("caps reviews at the daily maximum", () => {
		const defs = defsOf(10);
		let s = { ...createSchedule(defs), queue: [] };
		for (const d of defs) s = { ...s, cards: { ...s.cards, [d.key]: review(5) } };
		const { served } = studyDayOut(s, allLive(defs), 2, T0, { ...DEFAULT_LIMITS, reviewsPerDay: 4 });
		expect(served).toHaveLength(4);
	});

	it("takes a learning module due within 20 minutes rather than ending the day", () => {
		const defs = defsOf(1);
		let s = answer(createSchedule(defs), "t::m0", "x", 2, T0, DEFAULT_LIMITS); // due in 10 m
		expect(pick(s, allLive(defs))).toEqual({ key: "t::m0", kind: "learning" });
		s = answer(s, "t::m0", "y", 2, T0, DEFAULT_LIMITS); // graduated: tomorrow
		expect(nextModule(s, allLive(defs), T0, DEFAULT_LIMITS)).toEqual({ done: true, nextLearningAt: null });
	});

	it("reports when the next learning module is due", () => {
		const defs = defsOf(1);
		const s = answer(createSchedule(defs), "t::m0", "x", 1, T0, DEFAULT_LIMITS); // 5.5 m
		const later = T0 - 30 * MIN; // pretend it is earlier so the wait exceeds learn-ahead
		expect(nextModule({ ...s, cards: { "t::m0": { ...s.cards["t::m0"], due: T0 + 60 * MIN } } }, allLive(defs), later, DEFAULT_LIMITS)).toEqual({
			done: true,
			nextLearningAt: T0 + 60 * MIN,
		});
	});

	it("skips modules that are no longer in the file", () => {
		const defs = defsOf(3);
		expect(pick(createSchedule(defs), new Set(["t::m1", "t::m2"])).key).toBe("t::m1");
	});

	it("counts the day's work", () => {
		const defs = defsOf(5);
		let s = createSchedule(defs);
		s = answer(s, "t::m0", "x", 3, T0, DEFAULT_LIMITS);
		expect(s.queue).not.toContain("t::m0");
		expect(s.today).toEqual({ day: D0, newDone: 1, reviewsDone: 0 });
		expect(todayStats(s, allLive(defs), T0, DEFAULT_LIMITS)).toMatchObject({ newLeft: 4, due: 0, learning: 0 });
	});
});

describe("which question a visit asks", () => {
	const ids = ["OB1", "TO1", "OB2", "TO2", "OBx"];
	const kinds = { isTO: (id: string) => id.startsWith("TO"), answerable: (id: string) => id !== "OBx" };

	it("asks every question once — TO first, then OB, then unanswerable — before any repeats", () => {
		let card: ModuleCard = newCard();
		const asked: string[] = [];
		const rng = seeded(3);
		for (let i = 0; i < 5; i++) {
			const id = nextQuestion(card, ids, kinds, rng)!;
			asked.push(id);
			card = { ...card, lastId: id, questions: { ...card.questions, [id]: { seen: 1, last: 2, sum: 2, lastAt: i } } };
		}
		expect(asked.slice(0, 2).sort()).toEqual(["TO1", "TO2"]);
		expect(asked.slice(2, 4).sort()).toEqual(["OB1", "OB2"]);
		expect(asked[4]).toBe("OBx");
	});

	it("then asks the weakest: lowest last rating, then lowest average, then longest unseen", () => {
		const q = (last: Rating, sum: number, seen: number, lastAt: number) => ({ last, sum, seen, lastAt });
		const card: ModuleCard = {
			...newCard(),
			lastId: "OB1",
			questions: { OB1: q(0, 0, 1, 1), TO1: q(1, 4, 2, 2), OB2: q(1, 2, 2, 3), TO2: q(1, 2, 2, 0), OBx: q(3, 3, 1, 0) },
		};
		// OB1 has the lowest rating but was asked last; OB2 and TO2 tie on average, TO2 seen longer ago.
		expect(nextQuestion(card, ids, kinds, seeded())).toBe("TO2");
	});

	it("repeats the only question of a one-question module", () => {
		const card: ModuleCard = { ...newCard(), lastId: "A", questions: { A: { seen: 1, last: 2, sum: 2, lastAt: 0 } } };
		expect(nextQuestion(card, ["A"], kinds, seeded())).toBe("A");
	});
});

describe("answering", () => {
	it("records the question and clears the one on screen", () => {
		const defs = defsOf(2);
		let s = setCurrent(createSchedule(defs), { key: "t::m0", id: "Q0_1", kind: "new", revealed: null });
		s = reveal(s, 2);
		expect(s.current?.revealed).toEqual({ chosen: 2 });
		expect(reveal(s, 0).current?.revealed).toEqual({ chosen: 2 });
		s = answer(s, "t::m0", "Q0_1", 1, T0, DEFAULT_LIMITS);
		expect(s.current).toBeNull();
		expect(s.cards["t::m0"].questions.Q0_1).toEqual({ seen: 1, last: 1, sum: 1, lastAt: T0 });
		expect(s.cards["t::m0"].lastId).toBe("Q0_1");
	});
});

describe("completion", () => {
	it("is mature with every question seen and an interval of 21 days", () => {
		const seen = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { seen: 1, last: 2 as Rating, sum: 2, lastAt: 0 }]));
		expect(isMature({ ...review(21), questions: seen(["a", "b"]) }, ["a", "b"])).toBe(true);
		expect(isMature({ ...review(21), questions: seen(["a"]) }, ["a", "b"])).toBe(false);
		expect(isMature({ ...review(20), questions: seen(["a", "b"]) }, ["a", "b"])).toBe(false);
		const s = { ...createSchedule(defsOf(1, 1)), cards: { "t::m0": { ...review(30), questions: seen(["Q0_0"]) } } };
		expect(completedCount(s, () => ["Q0_0"])).toBe(1);
		expect(completedCount(s, () => undefined)).toBe(0);
	});
});

describe("migration", () => {
	it("keeps the version 1 queue order and starts every module new", () => {
		const v1 = { version: 1, queue: ["b", "a"], modules: { a: { attempts: 0 }, b: { attempts: 0 }, c: { attempts: 2 } } };
		const s = migrate(v1)!;
		expect(s.version).toBe(2);
		expect(s.queue).toEqual(["b", "a", "c"]);
		expect(s.cards.c).toEqual(newCard());
		expect(migrate(s)).toBe(s);
		expect(migrate(null)).toBeNull();
	});
});

describe("editing", () => {
	it("moves a module up, down, to the top and to the bottom", () => {
		const s = createSchedule(defsOf(4));
		expect(moveInQueue(s, "t::m2", "up").queue).toEqual(["t::m0", "t::m2", "t::m1", "t::m3"]);
		expect(moveInQueue(s, "t::m1", "down").queue).toEqual(["t::m0", "t::m2", "t::m1", "t::m3"]);
		expect(moveInQueue(s, "t::m3", "top").queue[0]).toBe("t::m3");
		expect(moveInQueue(s, "t::m0", "bottom").queue[3]).toBe("t::m0");
	});

	it("resets a module back into the queue at its file position", () => {
		const defs = defsOf(4);
		let s = createSchedule(defs);
		s = answer(s, "t::m0", "x", 3, T0, DEFAULT_LIMITS);
		s = answer(s, "t::m1", "x", 3, T0, DEFAULT_LIMITS);
		s = resetModule(s, "t::m1", defs);
		expect(s.queue).toEqual(["t::m1", "t::m2", "t::m3"]);
		expect(s.cards["t::m1"]).toEqual(newCard());
	});

	it("a module studied out of turn is introduced and leaves the queue", () => {
		const defs = defsOf(6);
		const s = answer(createSchedule(defs), "t::m4", "x", 2, T0, DEFAULT_LIMITS);
		expect(s.queue).not.toContain("t::m4");
		expect(s.cards["t::m4"].state).toBe("learning");
	});
});

describe("new modules", () => {
	const defs = defsOf(6);
	const base = createSchedule(defs.slice(0, 4).filter((d) => d.key !== "t::m1"));
	// Scheduled: m0, m2, m3. New in the file: m1 (between) and m4, m5 (after).
	const fresh = unplacedModules(base, defs).map((d) => d.key);

	it("finds modules the schedule has never seen", () => {
		expect(fresh).toEqual(["t::m1", "t::m4", "t::m5"]);
	});

	it("places them next up", () => {
		expect(placeModules(base, fresh, { where: "next" }, defs).queue).toEqual([
			"t::m1", "t::m4", "t::m5", "t::m0", "t::m2", "t::m3",
		]);
	});

	it("places them at the end", () => {
		expect(placeModules(base, fresh, { where: "end" }, defs).queue).toEqual([
			"t::m0", "t::m2", "t::m3", "t::m1", "t::m4", "t::m5",
		]);
	});

	it("places them in file order", () => {
		expect(placeModules(base, fresh, { where: "file" }, defs).queue).toEqual([
			"t::m0", "t::m1", "t::m2", "t::m3", "t::m4", "t::m5",
		]);
	});

	it("places them after a chosen module", () => {
		expect(placeModules(base, fresh, { where: "after", key: "t::m0" }, defs).queue).toEqual([
			"t::m0", "t::m1", "t::m4", "t::m5", "t::m2", "t::m3",
		]);
	});

	it("gives placed modules a new card, so they are no longer unplaced", () => {
		const s = placeModules(base, fresh, { where: "end" }, defs);
		expect(unplacedModules(s, defs)).toEqual([]);
		expect(s.cards["t::m4"]).toEqual(newCard());
	});
});
