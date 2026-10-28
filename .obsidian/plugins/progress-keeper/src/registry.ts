import { App, TFile } from "obsidian";

import { BarSpec, extractBars } from "./parse";

export interface BarEntry {
	spec: BarSpec;
	path: string;
}

/**
 * Every ```progress bar in the vault, by file. Only notes whose metadata cache
 * shows a code block are read, so the 12k MCQ notes cost nothing.
 */
export class Registry {
	private byPath = new Map<string, BarSpec[]>();

	constructor(
		private app: App,
		private defaults: () => { window: number; digits: number },
	) {}

	async scan(): Promise<void> {
		this.byPath.clear();
		const files = this.app.vault.getMarkdownFiles().filter((f) => {
			const sections = this.app.metadataCache.getFileCache(f)?.sections;
			return sections?.some((s) => s.type === "code");
		});
		await Promise.all(files.map(async (f) => this.update(f.path, await this.app.vault.cachedRead(f))));
	}

	/** Re-parse one note. Returns its bars (empty if it has none). */
	update(path: string, text: string): BarSpec[] {
		const bars = text.includes("progress") ? extractBars(text, this.defaults().window, this.defaults().digits) : [];
		if (bars.length) this.byPath.set(path, bars);
		else this.byPath.delete(path);
		return bars;
	}

	has(path: string): boolean {
		return this.byPath.has(path);
	}

	remove(path: string): void {
		this.byPath.delete(path);
	}

	async rename(file: TFile, oldPath: string): Promise<void> {
		this.byPath.delete(oldPath);
		if (file.extension === "md") this.update(file.path, await this.app.vault.cachedRead(file));
	}

	all(): BarEntry[] {
		const out: BarEntry[] = [];
		for (const [path, specs] of this.byPath) for (const spec of specs) out.push({ spec, path });
		return out.sort((a, b) => a.spec.title.localeCompare(b.spec.title));
	}

	/** All entries sharing an id — more than one means a clash the user should fix. */
	find(id: string): BarEntry[] {
		return this.all().filter((e) => e.spec.id === id);
	}
}
