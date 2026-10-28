// Type-only, so the pure helpers below stay importable outside Obsidian.
import type { App, TFile } from "obsidian";
import type { IndexEntry } from "./index";
import { TOPIC_NAMES } from "./topic-names";

/**
 * Turning a compressed topic tag into a readable name.
 *
 * There is no title-casing algorithm here, and there does not need to be one:
 * the vault already holds properly-cased names. The job is to find the right
 * one and *prove* it belongs to the tag, which is what `normalizeTopic` is for
 * — a candidate is only ever used if normalising it reproduces the tag exactly.
 * That makes a wrong label impossible; a topic with no provable source simply
 * keeps its raw tag.
 *
 * Three sources, in order of precedence:
 *   1. a hand-written name in `topic-names.ts`, which always wins;
 *   2. the H1 of the Orthobullets note that an OB question's `Topic:` wikilink
 *      points at — covers 759 of the 761 OB topics;
 *   3. word-alignment against the `Chapter:` line of a TO note.
 *
 * Between them every one of the 761 tags now has a name, so the raw-tag
 * fallback in `label()` should never be reached in this vault. It stays for
 * robustness if a new topic tag appears.
 */

/** Lowercase, `&` as "and", everything else non-alphanumeric dropped. */
export function normalizeTopic(text: string): string {
	return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

/**
 * Words a chapter title carries but the tag drops, e.g. the "of" in
 * `#complicationsthr` ← "Complications of THR". Only ever skipped when keeping
 * the word would break the match, so a tag that really does contain "of" still
 * aligns.
 */
const STOPWORDS = new Set(["of", "and", "the", "in", "for", "with", "a", "to", "on"]);

/** The value of a note's `Chapter:` line, or null if it has none. */
export function chapterLine(content: string): string | null {
	const m = /^Chapter:[ \t]*(.+?)[ \t]*$/m.exec(content);
	return m ? m[1] : null;
}

/** Strip the `<Section> MCQs — ` prefix and a stray `.docx` suffix from a `Chapter:` value. */
export function chapterOf(descriptor: string): string {
	const dash = descriptor.lastIndexOf("—");
	const chapter = dash === -1 ? descriptor : descriptor.slice(dash + 1);
	return chapter.replace(/\.docx$/i, "").trim();
}

/**
 * Walk the chapter's words left to right and return the leading span whose
 * normalised form is exactly the tag, or null if no such span exists.
 *
 * This is what turns "3D Printing in Orthopaedics and Patient Specific
 * Implants" into "3D Printing" for `#3dprinting`, while correctly refusing
 * "Anatomy, Biomechanics and Templating" for `#arthroplastytemplating`.
 */
export function alignDescriptor(tag: string, chapter: string): string | null {
	const target = normalizeTopic(tag);
	const words = chapter.split(/\s+/).filter((w) => w.length > 0);
	let acc = "";

	for (let i = 0; i < words.length; i++) {
		const piece = normalizeTopic(words[i]);
		if (piece === "") continue;

		const bare = words[i].toLowerCase().replace(/[^a-z]/g, "");
		if (STOPWORDS.has(bare) && !target.startsWith(acc + piece)) continue;

		acc += piece;
		if (acc === target) return tidySpan(words, i);
		if (!target.startsWith(acc)) return null;
	}
	return null;
}

/**
 * Clean up a span that stopped inside a bracket.
 *
 * `#anatomyknee` aligns against "Anatomy ( Knee )" after three words, which
 * would otherwise be shown as "Anatomy ( Knee". Pull in the closing bracket
 * that the match left behind, drop an unmatched opening one, and tighten the
 * spacing the source puts inside brackets.
 */
function tidySpan(words: string[], end: number): string {
	let last = end;
	while (last + 1 < words.length && /^[)\]]+$/.test(words[last + 1])) last++;

	return words
		.slice(0, last + 1)
		.join(" ")
		.replace(/\s*[([]\s*$/, "")
		.replace(/([([])\s+/g, "$1")
		.replace(/\s+([)\]])/g, "$1")
		.trim();
}

/**
 * Whether a candidate name is provably this tag's, by any of the three rules.
 *
 * Note that an exact normalised match is *not* the whole invariant: a label may
 * legitimately carry a stopword the tag omits ("Complications of THR" for
 * `#complicationsthr`), and an acronym tag is justified by the parenthesised
 * acronym at the end of its title ("… Epiphysis (SCFE)" for `#scfe`). This is
 * the guard the labeller applies before accepting anything.
 */
export function labelMatchesTag(tag: string, label: string): boolean {
	const target = normalizeTopic(tag);
	if (normalizeTopic(label) === target) return true;
	if (alignDescriptor(tag, label) !== null) return true;
	return acronymTail(tag, label) !== null;
}

/**
 * Match a tag that is itself an acronym against a title ending in that acronym
 * in parentheses: `#scfe` ← "Slipped Capital Femoral Epiphysis (SCFE)".
 */
export function acronymTail(tag: string, chapter: string): string | null {
	const m = /\(([A-Za-z]+)\)\s*$/.exec(chapter);
	return m && normalizeTopic(m[1]) === normalizeTopic(tag) ? chapter : null;
}

/** Accept a heading as a topic's name only if it normalises back to the tag. */
export function labelFromHeading(tag: string, heading: string | undefined): string | null {
	if (!heading) return null;
	const trimmed = heading.trim();
	if (trimmed === "") return null;
	return normalizeTopic(trimmed) === normalizeTopic(tag) ? trimmed : null;
}

/** Best label derivable from one TO descriptor line, or null. */
export function labelFromDescriptor(tag: string, descriptor: string): string | null {
	const chapter = chapterOf(descriptor);
	if (chapter === "") return null;
	return alignDescriptor(tag, chapter) ?? acronymTail(tag, chapter);
}

export class TopicLabeller {
	private labels = new Map<string, string>();
	/** Topics already looked at, so a miss is not retried on every render. */
	private resolved = new Set<string>();

	constructor(private app: App) {}

	reset(): void {
		this.labels.clear();
		this.resolved.clear();
	}

	/** Display name for a topic tag, falling back to the tag itself. */
	label(topic: string): string {
		return TOPIC_NAMES[topic] ?? this.labels.get(topic) ?? topic;
	}

	hasLabel(topic: string): boolean {
		return topic in TOPIC_NAMES || this.labels.has(topic);
	}

	/**
	 * Resolve an OB topic from its `Topic: [[slug]]` wikilink.
	 *
	 * Runs off the metadata cache alone — the link is in the question's cache
	 * and the H1 is in the target's — so priming all 761 OB topics costs no
	 * disk reads at all.
	 */
	primeFromCache(file: TFile, topic: string): void {
		if (this.resolved.has(topic)) return;

		const cache = this.app.metadataCache.getFileCache(file);
		const link = cache?.links?.[0]?.link;
		if (!link) return;

		const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
		if (!target) return;

		const heading = this.app.metadataCache.getFileCache(target)?.headings?.[0]?.heading;
		const label = labelFromHeading(topic, heading);
		this.resolved.add(topic);
		if (label) this.labels.set(topic, label);
	}

	/**
	 * Fill in whatever `primeFromCache` could not, by reading the `Chapter:` line of one
	 * representative note per topic. Bounded by the number of topics in a
	 * section (142 at worst), and each topic is only ever read once.
	 */
	async ensureTopicLabels(entries: IndexEntry[]): Promise<void> {
		const pending = new Map<string, string>();
		for (const entry of entries) {
			// hasLabel, not labels.has — a hand-written name means there is
			// nothing to look up and no file to read.
			if (this.hasLabel(entry.topic) || pending.has(entry.topic)) continue;
			pending.set(entry.topic, entry.path);
		}
		if (pending.size === 0) return;

		await Promise.all(
			[...pending].map(async ([topic, path]) => {
				const file = this.app.vault.getFileByPath(path);
				if (!file) return;
				try {
					const content = await this.app.vault.cachedRead(file as TFile);
					const descriptor = chapterLine(content);
					const label = descriptor ? labelFromDescriptor(topic, descriptor) : null;
					if (label) this.labels.set(topic, label);
				} catch {
					/* an unreadable note just leaves the tag raw */
				}
			}),
		);
	}
}
