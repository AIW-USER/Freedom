import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => {
	class TAbstractFile {}
	class TFile extends TAbstractFile { constructor(public path: string, public stat: { mtime: number }) { super(); } }
	return { TFile, TAbstractFile, normalizePath: (p: string) => p };
});
import { TFile } from "obsidian";
import { SyncEngine } from "../src/sync";

function setup(files: Record<string, string>, pairs: { a: string; b: string; intervalMs?: number }[], mtimes: Record<string, number> = {}) {
	const data = { ...files };
	const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
	const tfiles: Record<string, TFile> = {};
	for (const p of Object.keys(data)) tfiles[p] = new (TFile as any)(p, { mtime: mtimes[p] ?? 0 });
	const fire = (ev: string, ...a: unknown[]) => (handlers[ev] ?? []).forEach((h) => h(...a));
	const vault = {
		getAbstractFileByPath: (p: string) => tfiles[p] ?? null,
		read: async (f: TFile) => data[f.path],
		process: async (f: TFile, fn: (d: string) => string) => { data[f.path] = fn(data[f.path]); fire("modify", f); return data[f.path]; },
		on: (ev: string, h: (...a: unknown[]) => void) => ((handlers[ev] ??= []).push(h), { ev, h }),
		offref: () => {},
	};
	const timers: number[] = [];
	(globalThis as any).window = { setInterval: (_: unknown, ms: number) => timers.push(ms), clearInterval: () => {} };
	const moved: string[][] = [];
	const host = { pairs, defaultIntervalMs: 1000, onEndpointsMoved: (i: number, a: string, b: string) => moved.push([String(i), a, b]), onStatus: () => {} };
	const engine = new SyncEngine({ vault } as any, host);
	const edit = async (p: string, text: string) => { data[p] = text; fire("modify", tfiles[p]); await new Promise((r) => setTimeout(r, 10)); };
	return { data, engine, edit, moved, timers };
}

describe("SyncEngine", () => {
	it("syncs both ways, grows ranges, newer file wins at start", async () => {
		const s = setup({ "a.md": "x HELLO y", "b.md": "l1\nfoo OLD bar" }, [{ a: "a.md|1|3-7", b: "b.md|2|5-7" }], { "a.md": 2, "b.md": 1 });
		expect(await s.engine.start()).toBe(1);
		expect(s.data["b.md"]).toBe("l1\nfoo HELLO bar");
		await s.edit("a.md", "x HELLO THERE y");
		expect(s.data["b.md"]).toBe("l1\nfoo HELLO THERE bar");
		await s.edit("b.md", "l0\nl1\nfoo BYE bar");
		expect(s.data["a.md"]).toBe("x BYE y");
		expect(s.moved.at(-1)).toEqual(["0", "a.md|1|3-5", "b.md|3|5-7"]);
		expect(s.engine.status[0]?.ok).toBe(true);
	});

	it("handles both ranges in the same file", async () => {
		const s = setup({ "a.md": "AAA\nBBB" }, [{ a: "a.md|1|1-3", b: "a.md|2|1-3" }], {});
		await s.engine.start();
		expect(s.data["a.md"]).toBe("AAA\nAAA");
		await s.edit("a.md", "AAAxx\nAAA");
		expect(s.data["a.md"]).toBe("AAAxx\nAAAxx");
	});

	it("gives each pair its own check interval, none for 0", async () => {
		const s = setup({ "a.md": "abc", "b.md": "abc" }, [
			{ a: "a.md|1|1-1", b: "b.md|1|1-1", intervalMs: 5000 },
			{ a: "a.md|1|2-2", b: "b.md|1|2-2", intervalMs: 0 },
			{ a: "a.md|1|3-3", b: "b.md|1|3-3", intervalMs: 10 },
			{ a: "a.md|1|1-2", b: "b.md|1|1-2" },
		]);
		expect(await s.engine.start()).toBe(4);
		expect(s.timers).toEqual([5000, 250, 1000]);
	});

	it("reports bad pairs without starting them", async () => {
		const s = setup({ "a.md": "abc" }, [{ a: "a.md|1|1-2", b: "missing.md|1|1-2" }]);
		expect(await s.engine.start()).toBe(0);
		expect(s.engine.status[0]).toEqual({ ok: false, message: "File not found: missing.md" });
	});
});
