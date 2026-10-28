// Type-only, so this module stays importable outside Obsidian (the `obsidian`
// package ships types but no runtime).
import type { App, CachedMetadata, TFile } from "obsidian";
import {
	Family,
	META_TAGS,
	Section,
	SECTION_ALIASES,
	SECTION_LABELS,
	topicKey,
} from "./types";
import { RE_SOURCE_TAG } from "./parser";
import { canonicalTopic } from "./topic-aliases";

export interface IndexEntry {
	path: string;
	id: string;
	family: Family;
	section: Section;
	topic: string;
	aaos: boolean;
}

export interface SectionSummary {
	section: Section;
	label: string;
	count: number;
	topics: number;
}

export interface TopicSummary {
	section: Section;
	topic: string;
	count: number;
}

/**
 * Section/topic index built purely from Obsidian's metadata cache.
 *
 * Deliberately does not read file contents: with 12,528 notes that would be
 * ~34 MB of I/O on the startup path for information the browse tree does not
 * need. Question text is fetched lazily, one topic at a time, by the view.
 */
export class McqIndex {
	private entries = new Map<string, IndexEntry>();
	/** `section/topic` -> paths. Keyed compositely so a topic name reused across sections stays two topics. */
	private byTopic = new Map<string, string[]>();
	private bySection = new Map<Section, Set<string>>();
	private listeners = new Set<() => void>();
	/**
	 * Called for every note as it is indexed. The topic labeller hooks in here
	 * so it can read each OB note's `Topic:` wikilink off the same metadata
	 * cache lookup, rather than walking all 12,528 notes a second time.
	 */
	onEntryIndexed: ((file: TFile, entry: IndexEntry) => void) | null = null;

	constructor(
		private app: App,
		private folder: () => string,
	) {}

	onChange(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify(): void {
		for (const fn of this.listeners) fn();
	}

	get size(): number {
		return this.entries.size;
	}

	/** Full rebuild from the metadata cache. No disk reads. */
	rebuild(): void {
		this.entries.clear();
		this.byTopic.clear();
		this.bySection.clear();

		const prefix = this.folder() + "/";
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(prefix)) continue;
			this.insert(file, this.app.metadataCache.getFileCache(file));
		}
		this.notify();
	}

	upsert(file: TFile, cache?: CachedMetadata | null): void {
		if (!file.path.startsWith(this.folder() + "/")) return;
		this.remove(file.path, false);
		this.insert(file, cache ?? this.app.metadataCache.getFileCache(file));
		this.notify();
	}

	remove(path: string, notify = true): void {
		const entry = this.entries.get(path);
		if (!entry) return;
		this.entries.delete(path);

		const key = topicKey(entry.section, entry.topic);
		const bucket = this.byTopic.get(key);
		if (bucket) {
			const i = bucket.indexOf(path);
			if (i !== -1) bucket.splice(i, 1);
			if (bucket.length === 0) this.byTopic.delete(key);
		}
		this.bySection.get(entry.section)?.delete(key);
		if (notify) this.notify();
	}

	private insert(file: TFile, cache: CachedMetadata | null): void {
		const entry = classify(file, cache);
		if (!entry) return;

		this.entries.set(entry.path, entry);
		const key = topicKey(entry.section, entry.topic);

		let bucket = this.byTopic.get(key);
		if (!bucket) {
			bucket = [];
			this.byTopic.set(key, bucket);
		}
		bucket.push(entry.path);

		let sectionTopics = this.bySection.get(entry.section);
		if (!sectionTopics) {
			sectionTopics = new Set();
			this.bySection.set(entry.section, sectionTopics);
		}
		sectionTopics.add(key);

		this.onEntryIndexed?.(file, entry);
	}

	sections(): SectionSummary[] {
		const out: SectionSummary[] = [];
		for (const [section, keys] of this.bySection) {
			let count = 0;
			for (const key of keys) count += this.byTopic.get(key)?.length ?? 0;
			out.push({ section, label: SECTION_LABELS[section], count, topics: keys.size });
		}
		return out.sort((a, b) => a.label.localeCompare(b.label));
	}

	topics(section: Section): TopicSummary[] {
		const keys = this.bySection.get(section);
		if (!keys) return [];
		const out: TopicSummary[] = [];
		for (const key of keys) {
			const topic = key.slice(section.length + 1);
			out.push({ section, topic, count: this.byTopic.get(key)?.length ?? 0 });
		}
		return out.sort((a, b) => a.topic.localeCompare(b.topic));
	}

	/** Paths in a topic, in natural id order (OB2 before OB10). */
	questions(section: Section, topic: string): IndexEntry[] {
		const paths = this.byTopic.get(topicKey(section, topic)) ?? [];
		return paths
			.map((p) => this.entries.get(p))
			.filter((e): e is IndexEntry => e !== undefined)
			.sort((a, b) => compareIds(a.id, b.id));
	}

	all(): IndexEntry[] {
		return [...this.entries.values()];
	}

	get(path: string): IndexEntry | undefined {
		return this.entries.get(path);
	}
}

/** `OB2` before `OB10`. */
export function compareIds(a: string, b: string): number {
	const ma = /^([A-Za-z]+)(\d+)$/.exec(a);
	const mb = /^([A-Za-z]+)(\d+)$/.exec(b);
	if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
	return a.localeCompare(b);
}

/**
 * Derive section, topic and family from the metadata cache alone.
 *
 * Uses `cache.tags` rather than `getAllTags()` because only the former keeps
 * each tag's line number, which is what lets us ignore tag-shaped tokens
 * further down the note (OB1222 has a `#tab2` URL fragment in its body).
 */
export function classify(file: TFile, cache: CachedMetadata | null): IndexEntry | null {
	if (!cache?.tags?.length) return null;

	// Every note keeps its section/topic tags together on a single line near the
	// top, so take that line and ignore everything below it. Anchoring to the
	// first *tag* line rather than to the first heading matters: `cache.headings`
	// starts with the note's H1 on line 0, so a "before the first heading" filter
	// silently rejects every tag in the vault.
	const firstTagLine = Math.min(...cache.tags.map((t) => t.position.start.line));
	const lineTags = cache.tags
		.filter((t) => t.position.start.line === firstTagLine)
		.sort((a, b) => a.position.start.col - b.position.start.col)
		.map((t) => t.tag.replace(/^#/, ""));
	// The first tag is the source (OB, TO, …), by position, as in the parser.
	if (lineTags.length < 2 || !RE_SOURCE_TAG.test(lineTags[0])) return null;
	if (SECTION_ALIASES[lineTags[0].toLowerCase()]) return null;
	const family = lineTags[0].toUpperCase();
	const tags = lineTags.slice(1);

	let section: Section | null = null;
	let topic: string | null = null;
	let aaos = false;

	for (const tag of tags) {
		const lower = tag.toLowerCase();
		if (section === null && SECTION_ALIASES[lower]) {
			section = SECTION_ALIASES[lower];
			continue;
		}
		if (META_TAGS.has(lower)) {
			if (lower === "aaos") aaos = true;
			continue;
		}
		if (topic === null) topic = lower;
	}

	if (section === null || topic === null) return null;

	// Must match the parser: synonymous tags from the two banks are one topic.
	({ section, topic } = canonicalTopic(section, topic));

	return {
		path: file.path,
		id: file.basename,
		family,
		section,
		topic,
		aaos,
	};
}
