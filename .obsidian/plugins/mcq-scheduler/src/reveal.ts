/**
 * Which question has been answered, and how that reaches an already-rendered
 * reading view.
 *
 * Hiding is a rendering concern now, not a file concern: nothing here — and
 * nothing in reading.ts — ever writes to a note. Answering a question changes
 * one class on a handful of DOM nodes.
 */

import type { App, MarkdownView } from "obsidian";

/** Gated permanently: options and the correct option. */
export const CLS_GATE_ALWAYS = "mcq-gate-always";
/** Gated until answered: explanation and illustrations. */
export const CLS_GATE_ANSWER = "mcq-gate-answer";
/**
 * On the reading-view container once the question has been answered.
 *
 * The reveal state lives here, on the one element that is always present,
 * rather than as a class on each answer block — see {@link applyReveal}.
 */
export const CLS_ANSWERED = "mcq-answered";

/**
 * The revealed question. One entry, in memory, session-only.
 *
 * Session-only because a reveal persisted to data.json would mean a question
 * answered in March quietly shows its answer in June. One entry rather than a
 * set because moving to the next question must re-hide the last: a question you
 * come back to should quiz you again.
 */
export class RevealStore {
	private path: string | null = null;
	private listeners = new Set<(path: string | null) => void>();

	get revealedPath(): string | null {
		return this.path;
	}

	isRevealed(path: string): boolean {
		return this.path !== null && this.path === path;
	}

	/** Reveal `path`. Idempotent. */
	answer(path: string): void {
		if (this.path === path) return;
		this.path = path;
		this.notify();
	}

	clear(): void {
		if (this.path === null) return;
		this.path = null;
		this.notify();
	}

	onChange(fn: (path: string | null) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify(): void {
		for (const fn of this.listeners) fn(this.path);
	}
}

/**
 * Bring one open note's reading view in line with the reveal state, in both
 * directions.
 *
 * One class, on the container. It cannot be a class on each answer block:
 * Obsidian renders the reading view lazily and *detaches* every section outside
 * the render range, so a walk of the live DOM never reaches an explanation that
 * is well below the viewport. That block would keep whatever class it was given
 * when it was last rendered, and scrolling down to it later would re-attach it
 * still hidden. Keeping the state on the container means a section is styled
 * correctly by the time it is re-attached, however far away it was.
 *
 * Deliberately not `previewMode.rerender()`: re-rendering a 3,000-word
 * explanation with three images throws away the scroll position, re-decodes the
 * images and flashes. This is a single class toggle.
 */
export function applyReveal(view: MarkdownView, revealed: boolean): void {
	const root = view.contentEl;
	const containers = Array.from(root.querySelectorAll<HTMLElement>(".markdown-reading-view"));
	if (root.hasClass("markdown-reading-view")) containers.push(root);
	for (const el of containers) el.toggleClass(CLS_ANSWERED, revealed);
}

/** Sweep every open markdown leaf. A handful of leaves, a few dozen nodes each. */
export function syncAllViews(app: App, store: RevealStore): void {
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view as MarkdownView;
		if (!view?.file) continue;
		applyReveal(view, store.isRevealed(view.file.path));
	}
}
