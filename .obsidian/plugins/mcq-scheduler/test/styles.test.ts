import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** The selectors and body of the one rule that hides answers. */
function hideRule(): { selectors: string; body: string } {
	const m = /([^}]*\.mcq-gate-answer\s*)\{([^}]*)\}/.exec(css);
	expect(m, "no rule hiding .mcq-gate-answer in styles.css").not.toBeNull();
	return { selectors: m![1], body: m![2] };
}

describe("the reading-view hiding rule", () => {
	/**
	 * Obsidian renders the reading view lazily and measures each section as
	 * `(nextSibling ?? el).offsetTop - el.offsetTop`. A display:none element
	 * reports offsetTop 0, so a hidden block measures as the absolute offset of
	 * the block after it — hundreds of phantom pixels — and a hidden last block
	 * measures 0, which Obsidian pads with the average section height instead.
	 * The virtual scroll geometry then disagrees with the real one and the view
	 * jumps to the end of the note as you scroll in. Hidden blocks must stay in
	 * the layout flow.
	 */
	it("never takes a hidden block out of the layout flow", () => {
		expect(hideRule().body).not.toMatch(/display\s*:\s*none/);
	});

	it("gives a hidden block a non-zero height, so it is never measured as 0", () => {
		const height = /(?:^|[\s;])height\s*:\s*([^;]+)/.exec(hideRule().body);
		expect(height, "no height on the hide rule").not.toBeNull();
		expect(parseFloat(height![1])).toBeGreaterThan(0);
	});

	it("hides the subtree with content-visibility rather than by painting over it", () => {
		expect(hideRule().body).toMatch(/content-visibility\s*:\s*hidden/);
	});

	it("hides only inside the reading view, so source mode and exports are whole", () => {
		expect(hideRule().selectors).toMatch(/\.markdown-reading-view/);
	});

	/**
	 * The reveal state is a class on the container, because the lazy renderer
	 * detaches sections outside the render range and a per-block class cannot be
	 * kept in step with them. If the gate is ever keyed off the block again, an
	 * explanation far below the fold stays hidden after you answer.
	 */
	it("gates the answer blocks on the container, not on the block", () => {
		expect(hideRule().selectors).toMatch(/\.markdown-reading-view:not\(\.mcq-answered\)/);
	});

	it("never un-hides from CSS — revealing is the container class alone", () => {
		expect(css).not.toMatch(/content-visibility\s*:\s*(visible|auto)/);
		expect(css).not.toMatch(/\.mcq-gate-\w+\s*\{[^}]*display\s*:\s*(block|revert|initial)/);
	});
});
