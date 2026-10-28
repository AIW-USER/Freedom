/**
 * The reading-view hider.
 *
 * One markdown post-processor tags each rendered block with the `## ` section
 * it came from and, if that section is gated, adds `mcq-hidden` before Obsidian
 * inserts the element into the live DOM — so a hidden answer never gets a
 * painted frame. The markdown on disk is untouched: Ctrl+E shows everything.
 *
 * Scope is the folder setting, so the rest of the vault renders normally.
 */

import type { MarkdownPostProcessorContext, TFile } from "obsidian";

import type McqSchedulerPlugin from "./main";
import { CLS_GATE_ALWAYS, CLS_GATE_ANSWER } from "./reveal";
import { Gate, gateForHeading, gateForLine, HeadingRef, headingRefs } from "./sections";

export function registerReadingHider(plugin: McqSchedulerPlugin): void {
	// Synchronous and with the default sort order on purpose: the element is
	// mutated before insertion, which is what makes the hiding flash-free.
	plugin.registerMarkdownPostProcessor((el, ctx) => processBlock(plugin, el, ctx));
}

/**
 * The note's level-2 headings, from the metadata cache.
 *
 * Read from the cache rather than from `MarkdownSectionInformation.text`
 * because what that field holds is not something the typings promise. The cache
 * is already loaded for all 12,528 notes — the index is built from it — so this
 * costs nothing.
 */
function headingsFor(plugin: McqSchedulerPlugin, path: string): HeadingRef[] {
	const file = plugin.app.vault.getFileByPath(path) as TFile | null;
	const headings = file ? plugin.app.metadataCache.getFileCache(file)?.headings : null;
	if (!headings) return [];
	return headings
		.filter((h) => h.level === 2)
		.map((h) => ({ heading: h.heading, line: h.position.start.line }));
}

function processBlock(
	plugin: McqSchedulerPlugin,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	if (!plugin.settings.hideInReadingView) return;

	const path = ctx.sourcePath;
	if (!path.startsWith(plugin.settings.mcqFolder + "/")) return;

	// Note that nothing here consults the reveal state. A block is labelled with
	// the gate it belongs to and that is all; whether the gate is currently open
	// is the container's class, so a block renders correctly whenever it happens
	// to be rendered. See applyReveal in reveal.ts.
	//
	// getSectionInfo is documented as returning null "in many circumstances" —
	// exports, some embeds — so every use below is guarded.
	const info = ctx.getSectionInfo(el);

	let headings = headingsFor(plugin, path);
	if (headings.length === 0 && info) headings = headingRefs(info.text.split("\n"));
	if (headings.length === 0) return;

	if (info) {
		tag(el, gateForLine(headings, info.lineStart));
		return;
	}

	// No section info: this is a whole-document render (an embed, an export,
	// a hover popover). Walk the children in order instead.
	if (tagByDomOrder(el)) return;

	// Nothing identified the block. Leave it visible rather than guess: the only
	// way to get here is not knowing what the block is, and hiding on a guess
	// would blank the question the side pane is asking about.
}

/**
 * Attribute blocks by DOM order when the whole note has been rendered into one
 * container. Returns false if `el` holds no headings, in which case the caller
 * has nothing to go on.
 */
function tagByDomOrder(el: HTMLElement): boolean {
	const kids = Array.from(el.children) as HTMLElement[];
	const headingOf = (kid: HTMLElement): HTMLElement | null =>
		kid.tagName === "H2" ? kid : kid.querySelector<HTMLElement>(":scope > h2");

	if (!kids.some((kid) => headingOf(kid) !== null)) return false;

	let current: string | null = null;
	for (const kid of kids) {
		const h2 = headingOf(kid);
		if (h2) current = (h2.textContent ?? "").trim();
		tag(kid, gateForHeading(current));
	}
	return true;
}

function tag(el: HTMLElement, gate: Gate): void {
	if (gate === "visible") return;
	// Readable in devtools, and the hook for a snippet that wants to style the
	// gap where an answer sits.
	el.dataset.mcqGate = gate;
	el.addClass(gate === "always" ? CLS_GATE_ALWAYS : CLS_GATE_ANSWER);
}
