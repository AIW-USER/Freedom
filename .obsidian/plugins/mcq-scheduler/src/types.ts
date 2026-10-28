import { DEFAULT_PROGRESS_SETTINGS, ProgressSettings } from "./progress/settings";

/**
 * The source code from the first tag on the tag line: "OB", "TO", or any new
 * 2–5 letter code a future bank is tagged with.
 */
export type Family = string;

export const SECTIONS = [
	"basics",
	"footankle",
	"hand",
	"kneesports",
	"pathology",
	"pediatrics",
	"recon",
	"shoulderelbow",
	"spine",
	"trauma",
] as const;

export type Section = (typeof SECTIONS)[number];

/**
 * Tag spellings that map onto a canonical section.
 *
 * Lookups are lowercased first, so case never matters: the 964 OB files
 * currently tag `#Shoulderelbow` and the 196 TO files `#shoulderelbow`, and
 * both land here. `shoulder` and `shoulder&elbow` are kept for the OB spelling
 * that came before — Obsidian's tag parser stops at the first illegal
 * character, so `#shoulder&elbow` was indexed as `#shoulder`. They cost
 * nothing and mean a rename in either direction keeps working.
 */
export const SECTION_ALIASES: Record<string, Section> = {
	basics: "basics",
	footankle: "footankle",
	hand: "hand",
	kneesports: "kneesports",
	pathology: "pathology",
	pediatrics: "pediatrics",
	recon: "recon",
	shoulder: "shoulderelbow",
	"shoulder&elbow": "shoulderelbow",
	shoulderelbow: "shoulderelbow",
	spine: "spine",
	trauma: "trauma",
};

export const SECTION_LABELS: Record<Section, string> = {
	basics: "Basic Science",
	footankle: "Foot & Ankle",
	hand: "Hand",
	kneesports: "Knee & Sports",
	pathology: "Pathology",
	pediatrics: "Pediatrics",
	recon: "Recon",
	shoulderelbow: "Shoulder & Elbow",
	spine: "Spine",
	trauma: "Trauma",
};

/** Tags after the source tag that are neither a section nor a topic. */
export const META_TAGS = new Set(["aaos"]);

export interface MCQOption {
	/** 0-based position in the options list. */
	index: number;
	/** "1".."5", as numbered in the note. */
	label: string;
	/** Option body with the label prefix stripped. */
	text: string;
}

/**
 * How an answer block sits in the file. Everything reads "plain" now that the
 * bank has been stripped; it is still reported so a note restored from an old
 * backup is visible as the odd one out.
 */
export type HideState = "plain" | "folded" | "open" | "absent";

export interface MCQHideStates {
	correct: HideState;
	explanation: HideState;
	illustrations: HideState;
}

export interface MCQ {
	/** From the H1; equals the file basename. */
	id: string;
	path: string;
	family: Family;
	section: Section;
	/** Bare topic tag, no leading '#'. */
	topic: string;
	/** Tags that are neither the family marker nor the section nor the topic, e.g. ["AAOS"]. */
	extraTags: string[];
	/** From the `Exam:` line, e.g. "2005 Practice Test | Question 40". */
	examLine: string | null;
	/** From the `Chapter:` line, e.g. "Arthritis MCQs — Inflammatory and Miscellaneous Arthritis". */
	descriptor: string | null;
	sourceUrl: string | null;
	/** From the `Topic:` line: the target of `[[acl-tear]]`. */
	topicLink: string | null;
	questionText: string;
	/** Embed targets in the Question body. */
	questionImages: string[];
	options: MCQOption[];
	/** null for the 95 TO files whose answer was never recorded. */
	correctIndex: number | null;
	/** The `## Correct option` body line, verbatim, callout-unwrapped. */
	correctRaw: string;
	explanation: string;
	illustrations: string | null;
	hide: MCQHideStates;
}

/** Composite key, so a topic name reused under two sections can never merge them silently. */
export function topicKey(section: Section, topic: string): string {
	return `${section}/${topic}`;
}

export interface McqSettings {
	mcqFolder: string;
	autoOpenFile: boolean;
	/**
	 * Master switch for render-time hiding in reading view. Off renders every
	 * note as written, without disabling the plugin.
	 */
	hideInReadingView: boolean;
	searchResultCap: number;
	/** Option button size, as a percentage of the theme's body text size. */
	optionScale: number;
	/** Vault path of the MCQ activity note, or "" until "Start activity log" is pressed. */
	activityPath: string;
	/** Progress bars, heat maps and the status bar. */
	progress: ProgressSettings;
	/** Vault path of the modules file the schedule is built from. */
	modulesFile: string;
}

export const DEFAULT_SETTINGS: McqSettings = {
	mcqFolder: "MCQ",
	autoOpenFile: true,
	hideInReadingView: true,
	searchResultCap: 200,
	optionScale: 100,
	activityPath: "",
	progress: DEFAULT_PROGRESS_SETTINGS,
	modulesFile: "Question Modules.md",
};

export class McqParseError extends Error {
	constructor(
		readonly path: string,
		message: string,
	) {
		super(`${path}: ${message}`);
		this.name = "McqParseError";
	}
}
