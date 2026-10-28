import { App, EventRef, TAbstractFile, TFile, normalizePath } from "obsidian";
import { Endpoint, MIN_INTERVAL_MS, formatEndpoint, parseEndpoint, readRange, trackEdit, writeRange } from "./core";
import type { Pair } from "./settings";

/** What the engine needs from the plugin. */
export interface SyncHost {
	readonly pairs: Pair[];
	/** Check interval for pairs that don't set their own. */
	readonly defaultIntervalMs: number;
	/** An edit moved or resized an endpoint; `a`/`b` are the new box texts. */
	onEndpointsMoved(index: number, a: string, b: string): void;
	onStatus(): void;
}

export interface PairStatus {
	ok: boolean;
	message: string;
}

interface Side {
	ep: Endpoint;
	/** File text as last seen, used to work out how an edit moved the range. */
	lastText: string;
}

interface Link {
	index: number;
	a: Side;
	b: Side;
	/** The value both sides held after the last sync. */
	value: string;
}

export class SyncEngine {
	running = false;
	/** Indexed like `host.pairs`. */
	status: (PairStatus | undefined)[] = [];
	private links: Link[] = [];
	private refs: EventRef[] = [];
	private timers: number[] = [];
	private queue: Promise<void> = Promise.resolve();

	constructor(private app: App, private host: SyncHost) {}

	get activeCount(): number {
		return this.links.length;
	}

	/** Starts syncing every valid pair. Returns how many pairs are active. */
	async start(): Promise<number> {
		this.stop();
		this.status = [];
		for (let i = 0; i < this.host.pairs.length; i++) {
			try {
				await this.initLink(i, this.host.pairs[i]);
			} catch (e) {
				this.setStatus(i, false, `Could not start: ${String(e)}`);
			}
		}
		if (this.links.length === 0) {
			this.host.onStatus();
			return 0;
		}

		const vault = this.app.vault;
		this.refs.push(
			vault.on("modify", (f) => {
				if (f instanceof TFile) this.enqueue(() => this.fileChanged(f.path));
			}),
			vault.on("rename", (f, oldPath) => this.renamed(f, oldPath)),
			vault.on("delete", (f) => {
				if (f instanceof TFile) this.enqueue(() => this.fileChanged(f.path));
			}),
		);
		// Backup for any change the vault events miss, on each pair's own interval.
		for (const link of this.links) {
			const ms = this.host.pairs[link.index]?.intervalMs ?? this.host.defaultIntervalMs;
			if (ms > 0) {
				this.timers.push(window.setInterval(() => this.enqueue(() => this.poll(link)), Math.max(MIN_INTERVAL_MS, ms)));
			}
		}
		this.running = true;
		this.reportMoved();
		this.host.onStatus();
		return this.links.length;
	}

	stop(): void {
		for (const ref of this.refs) this.app.vault.offref(ref);
		this.refs = [];
		for (const t of this.timers) window.clearInterval(t);
		this.timers = [];
		this.links = [];
		this.running = false;
	}

	private enqueue(task: () => Promise<void>): void {
		this.queue = this.queue.then(() => (this.running ? task() : undefined)).catch((e) => console.error("Equilizer:", e));
	}

	private file(path: string): TFile | null {
		const p = normalizePath(path);
		const f = this.app.vault.getAbstractFileByPath(p) ?? (/\.[^/]+$/.test(p) ? null : this.app.vault.getAbstractFileByPath(`${p}.md`));
		return f instanceof TFile ? f : null;
	}

	private setStatus(index: number, ok: boolean, message: string): void {
		this.status[index] = { ok, message };
	}

	private okStatus(link: Link): void {
		const v = link.value.length > 60 ? `${link.value.slice(0, 60)}…` : link.value;
		this.setStatus(link.index, true, `Synced: "${v}"`);
	}

	private sides(): { link: Link; side: Side; other: Side }[] {
		return this.links.flatMap((link) => [
			{ link, side: link.a, other: link.b },
			{ link, side: link.b, other: link.a },
		]);
	}

	private async initLink(index: number, pair: Pair): Promise<void> {
		if (!pair.a.trim() && !pair.b.trim()) return;
		const pa = parseEndpoint(pair.a);
		if (!pa.ok) return this.setStatus(index, false, `Left box: ${pa.error}`);
		const pb = parseEndpoint(pair.b);
		if (!pb.ok) return this.setStatus(index, false, `Right box: ${pb.error}`);
		const fa = this.file(pa.value.path);
		if (!fa) return this.setStatus(index, false, `File not found: ${pa.value.path}`);
		const fb = this.file(pb.value.path);
		if (!fb) return this.setStatus(index, false, `File not found: ${pb.value.path}`);
		const a: Endpoint = { ...pa.value, path: fa.path };
		const b: Endpoint = { ...pb.value, path: fb.path };

		const ta = await this.app.vault.read(fa);
		const tb = await this.app.vault.read(fb);
		const va = readRange(ta, a);
		if (!va.ok) return this.setStatus(index, false, `Left box: ${va.error}`);
		const vb = readRange(tb, b);
		if (!vb.ok) return this.setStatus(index, false, `Right box: ${vb.error}`);

		const link: Link = { index, a: { ep: a, lastText: ta }, b: { ep: b, lastText: tb }, value: va.value };
		this.links.push(link);
		if (va.value !== vb.value) {
			// Both sides differ at start-up: the file saved most recently wins.
			const aNewer = fa.stat.mtime >= fb.stat.mtime;
			link.value = aNewer ? va.value : vb.value;
			const error = await this.writeSide(aNewer ? link.b : link.a, link.value);
			if (error) {
				this.links.pop();
				return this.setStatus(index, false, error);
			}
		}
		this.okStatus(link);
	}

	/** Bring every endpoint in `path` up to date with the file's new text. */
	private track(path: string, text: string): void {
		for (const { side } of this.sides()) {
			if (side.ep.path !== path || side.lastText === text) continue;
			side.ep = trackEdit(side.lastText, text, side.ep);
			side.lastText = text;
		}
	}

	private async fileChanged(path: string): Promise<void> {
		const touched = this.links.filter((l) => l.a.ep.path === path || l.b.ep.path === path);
		if (touched.length === 0) return;
		const file = this.file(path);
		if (!file) {
			for (const l of touched) this.setStatus(l.index, false, `File not found: ${path}`);
			this.host.onStatus();
			return;
		}
		this.track(path, await this.app.vault.read(file));
		for (const link of touched) await this.check(link);
		this.reportMoved();
		this.host.onStatus();
	}

	/** Copy whichever side changed since the last sync onto the other side. */
	private async check(link: Link): Promise<void> {
		const va = readRange(link.a.lastText, link.a.ep);
		if (!va.ok) return this.setStatus(link.index, false, `Left box: ${va.error}`);
		const vb = readRange(link.b.lastText, link.b.ep);
		if (!vb.ok) return this.setStatus(link.index, false, `Right box: ${vb.error}`);

		let target: Side;
		let value: string;
		if (va.value !== link.value) [target, value] = [link.b, va.value];
		else if (vb.value !== link.value) [target, value] = [link.a, vb.value];
		else return this.okStatus(link);

		link.value = value;
		if ((target === link.a ? va.value : vb.value) !== value) {
			const error = await this.writeSide(target, value);
			if (error) return this.setStatus(link.index, false, error);
		}
		this.okStatus(link);
	}

	/** Writes `value` into one side's range. Returns an error message on failure. */
	private async writeSide(side: Side, value: string): Promise<string | null> {
		const file = this.file(side.ep.path);
		if (!file) return `File not found: ${side.ep.path}`;
		let error: string | null = null;
		await this.app.vault.process(file, (data) => {
			this.track(file.path, data);
			const w = writeRange(data, side.ep, value);
			if (!w.ok) {
				error = w.error;
				return data;
			}
			// Other ranges in the same file shift around the write.
			for (const { side: s } of this.sides()) {
				if (s.ep.path !== file.path) continue;
				s.ep = s === side ? w.value.endpoint : trackEdit(data, w.value.text, s.ep);
				s.lastText = w.value.text;
			}
			return w.value.text;
		});
		return error;
	}

	/** Re-read one pair's files and sync if either changed without an event. */
	private async poll(link: Link): Promise<void> {
		for (const side of link.a.ep.path === link.b.ep.path ? [link.a] : [link.a, link.b]) {
			const file = this.file(side.ep.path);
			if (!file || (await this.app.vault.read(file)) !== side.lastText) await this.fileChanged(side.ep.path);
		}
	}

	private renamed(f: TAbstractFile, oldPath: string): void {
		if (!(f instanceof TFile)) return;
		let moved = false;
		for (const { side } of this.sides()) {
			if (side.ep.path === oldPath) {
				side.ep = { ...side.ep, path: f.path };
				moved = true;
			}
		}
		if (moved) this.reportMoved();
	}

	private reportMoved(): void {
		for (const link of this.links) {
			this.host.onEndpointsMoved(link.index, formatEndpoint(link.a.ep), formatEndpoint(link.b.ep));
		}
	}
}
