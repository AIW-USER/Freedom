import { describe, expect, it } from "vitest";

import type { ModuleDef } from "../src/modules";
import {
	createSchedule,
	finishSession,
	gapFor,
	moveInQueue,
	nextModule,
	pickQuestions,
	pickSize,
	placeModules,
	recordAnswer,
	resetModule,
	Result,
	ScheduleState,
	startSession,
	unplacedModules,
	emptyModule,
	completedCount,
} from "../src/schedule";

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

/** Serve the next module and answer every question with `result`. */
function solveNext(state: ScheduleState, live: Set<string>, result: (key: string) => Result) {
	const pick = nextModule(state, live)!;
	let s = startSession(state, pick.key, pick.kind, [`${pick.key}#a`, `${pick.key}#b`]);
	for (const id of s.current!.ids) s = recordAnswer(s, id, { result: result(pick.key), chosen: 0 });
	const done = finishSession(s)!;
	return { pick, ...done };
}

const allLive = (defs: ModuleDef[]) => new Set(defs.map((d) => d.key));

describe("serving order", () => {
	it("serves three new modules, then one repeat", () => {
		const defs = defsOf(20);
		const live = allLive(defs);
		let s = createSchedule(defs);
		const kinds: string[] = [];
		for (let i = 0; i < 12; i++) {
			const r = solveNext(s, live, () => -1);
			kinds.push(r.pick.kind[0].toUpperCase());
			s = r.state;
		}
		expect(kinds.join("")).toBe("NNNRNNNRNNNR");
	});

	it("serves new modules in queue order starting from the first", () => {
		const defs = defsOf(5);
		const s = createSchedule(defs);
		expect(nextModule(s, allLive(defs))).toEqual({ key: "t::m0", kind: "new" });
	});

	it("repeats the lowest-scoring eligible module", () => {
		const defs = defsOf(10);
		const live = allLive(defs);
		let s = createSchedule(defs);
		const scores: Record<string, Result> = { "t::m0": 0, "t::m1": -1, "t::m2": 1 };
		for (let i = 0; i < 3; i++) s = solveNext(s, live, (k) => scores[k] ?? 1).state;
		// The repeat is due, but m1 (gap 2) has waited only 1: one more new first.
		const fourth = solveNext(s, live, () => 1);
		expect(fourth.pick).toEqual({ key: "t::m3", kind: "new" });
		expect(solveNext(fourth.state, live, () => 1).pick).toEqual({ key: "t::m1", kind: "repeat" });
	});

	it("among eligible repeats takes the lowest score, then the fewest attempts", () => {
		const defs = defsOf(4);
		const s: ScheduleState = {
			...createSchedule(defs),
			queue: [],
			sessionCount: 50,
			slot: 3,
			modules: {
				"t::m0": { ...emptyModule(), attempts: 1, score: 0, lastSolvedAt: 1 },
				"t::m1": { ...emptyModule(), attempts: 2, score: -0.5, lastSolvedAt: 2 },
				"t::m2": { ...emptyModule(), attempts: 1, score: -0.5, lastSolvedAt: 3 },
				"t::m3": { ...emptyModule(), attempts: 1, score: -1, lastSolvedAt: 50 },
			},
		};
		// m3 is lowest but was just solved and has not waited its gap.
		expect(nextModule(s, allLive(defs))).toEqual({ key: "t::m2", kind: "repeat" });
	});

	it("keeps serving new modules while no repeat has waited its gap", () => {
		const defs = defsOf(10);
		const live = allLive(defs);
		let s = createSchedule(defs);
		// All perfect: gap after one attempt is 2 + 2·1·2 = 6, so m0 is back 6 modules later.
		const kinds: string[] = [];
		for (let i = 0; i < 8; i++) {
			const r = solveNext(s, live, () => 1);
			kinds.push(r.pick.kind[0].toUpperCase());
			s = r.state;
		}
		expect(kinds.join("")).toBe("NNNNNNNR");
	});

	it("repeats only once everything new is used, never the one just solved", () => {
		const defs = defsOf(2);
		const live = allLive(defs);
		let s = createSchedule(defs);
		s = solveNext(s, live, () => 1).state;
		s = solveNext(s, live, () => 1).state;
		expect(nextModule(s, live)).toEqual({ key: "t::m0", kind: "repeat" });
	});

	it("skips modules that are no longer in the file", () => {
		const defs = defsOf(3);
		const s = createSchedule(defs);
		expect(nextModule(s, new Set(["t::m2"]))?.key).toBe("t::m2");
	});

	it("returns null once every module is completed", () => {
		const defs = defsOf(1);
		const live = allLive(defs);
		let s = createSchedule(defs);
		for (let i = 0; i < 3; i++) s = solveNext(s, live, () => 1).state;
		expect(nextModule(s, live)).toBeNull();
	});
});

describe("gap", () => {
	it("grows with score and attempts", () => {
		const m = (attempts: number, score: number) => ({ ...emptyModule(), attempts, score });
		expect(gapFor(m(1, -1))).toBe(2);
		expect(gapFor(m(3, -1))).toBe(2);
		expect(gapFor(m(1, 0))).toBe(4);
		expect(gapFor(m(2, 1))).toBe(10);
		expect(gapFor(m(2, 0.5))).toBeGreaterThan(gapFor(m(2, 0)));
	});
});

describe("question pick", () => {
	it("takes 40%, rounded up, at least one", () => {
		expect([1, 2, 3, 5, 10, 16].map(pickSize)).toEqual([1, 1, 2, 2, 4, 7]);
	});

	it("asks questions not asked last time first", () => {
		const ids = ["a", "b", "c", "d", "e"];
		const picked = pickQuestions(ids, () => true, ["a", "b", "c"], seeded(3));
		expect(picked.length).toBe(2);
		expect(picked.sort()).toEqual(["d", "e"]);
	});

	it("always asks every TO question and samples 40% of the OB ones", () => {
		const ids = ["OB1", "OB2", "OB3", "OB4", "OB5", "TO1", "TO2"];
		const isTO = (id: string) => id.startsWith("TO");
		for (let seed = 1; seed <= 20; seed++) {
			const picked = pickQuestions(ids, () => true, [], seeded(seed), isTO);
			expect(picked.filter(isTO).sort()).toEqual(["TO1", "TO2"]);
			expect(picked.filter((id) => !isTO(id)).length).toBe(2); // ceil(0.4 × 5)
		}
	});

	it("asks only the TO questions when a module has no OB ones", () => {
		const picked = pickQuestions(["TO1", "TO2", "TO3"], () => true, [], seeded(), () => true);
		expect(picked.sort()).toEqual(["TO1", "TO2", "TO3"]);
	});

	it("leaves an unanswerable TO question out, since it could only ever score 0", () => {
		const picked = pickQuestions(["OB1", "TO1", "TO2"], (id) => id !== "TO2", [], seeded(), (id) =>
			id.startsWith("TO"),
		);
		expect(picked.sort()).toEqual(["OB1", "TO1"]);
	});

	it("leaves out unanswerable questions unless nothing else is left", () => {
		expect(pickQuestions(["a", "b"], (id) => id === "b", [], seeded())).toEqual(["b"]);
		expect(pickQuestions(["a"], () => false, [], seeded())).toEqual(["a"]);
	});
});

describe("scoring and completion", () => {
	it("scores the session average of +1, 0 and −1", () => {
		const defs = defsOf(1);
		let s = startSession(createSchedule(defs), "t::m0", "new", ["a", "b", "c", "d"]);
		s = recordAnswer(s, "a", { result: 1, chosen: 0 });
		s = recordAnswer(s, "b", { result: 1, chosen: 0 });
		s = recordAnswer(s, "c", { result: 0, chosen: null });
		expect(finishSession(s)).toBeNull(); // not finished until every question is answered
		s = recordAnswer(s, "d", { result: -1, chosen: 2 });
		const done = finishSession(s)!;
		expect(done.tally).toEqual({ right: 2, skipped: 1, wrong: 1, average: 0.25 });
		expect(done.state.modules["t::m0"]).toMatchObject({ attempts: 1, score: 0.25, perfect: 0 });
		expect(done.state.queue).not.toContain("t::m0");
	});

	it("keeps the first answer to a question", () => {
		let s = startSession(createSchedule(defsOf(1)), "t::m0", "new", ["a"]);
		s = recordAnswer(s, "a", { result: -1, chosen: 1 });
		s = recordAnswer(s, "a", { result: 1, chosen: 0 });
		expect(s.current!.answers.a.result).toBe(-1);
	});

	it("completes after three perfect sessions, not necessarily in a row", () => {
		const defs = defsOf(1);
		const live = allLive(defs);
		let s = createSchedule(defs);
		const results: Result[] = [1, -1, 1, 0, 1];
		let completedAt = -1;
		results.forEach((r, i) => {
			if (completedAt !== -1) return;
			const done = solveNext(s, live, () => r);
			s = done.state;
			if (done.completedNow) completedAt = i;
		});
		expect(completedAt).toBe(4);
		expect(completedCount(s)).toBe(1);
	});

	it("resumes a session with its answers intact", () => {
		let s = startSession(createSchedule(defsOf(1)), "t::m0", "new", ["a", "b"]);
		s = recordAnswer(s, "a", { result: 1, chosen: 3 });
		const reloaded: ScheduleState = JSON.parse(JSON.stringify(s));
		expect(reloaded.current!.answers).toEqual({ a: { result: 1, chosen: 3 } });
		expect(reloaded.current!.ids).toEqual(["a", "b"]);
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
		const live = allLive(defs);
		let s = createSchedule(defs);
		s = solveNext(s, live, () => 1).state; // m0 solved
		s = solveNext(s, live, () => 1).state; // m1 solved
		s = resetModule(s, "t::m1", defs);
		expect(s.queue).toEqual(["t::m1", "t::m2", "t::m3"]);
		expect(s.modules["t::m1"]).toEqual(emptyModule());
	});

	it("a module started out of turn leaves the cycle where it was", () => {
		const defs = defsOf(6);
		let s = startSession(createSchedule(defs), "t::m4", "manual", ["x"]);
		s = recordAnswer(s, "x", { result: 1, chosen: 0 });
		s = finishSession(s)!.state;
		expect(s.slot).toBe(0);
		expect(s.queue).not.toContain("t::m4");
		expect(nextModule(s, allLive(defs))?.key).toBe("t::m0");
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

	it("gives placed modules a zero record, so they are no longer new", () => {
		const s = placeModules(base, fresh, { where: "end" }, defs);
		expect(unplacedModules(s, defs)).toEqual([]);
		expect(s.modules["t::m4"]).toEqual(emptyModule());
	});
});
