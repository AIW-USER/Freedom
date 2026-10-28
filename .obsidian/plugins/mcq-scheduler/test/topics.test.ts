import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	alignDescriptor,
	chapterLine,
	chapterOf,
	labelFromDescriptor,
	labelMatchesTag,
	labelFromHeading,
	normalizeTopic,
} from "../src/topics";
import { TOPIC_NAMES } from "../src/topic-names";

const VAULT = "/Users/phaneendra/Freedom";
const MCQ_DIR = join(VAULT, "MCQ");
const OB_DIR = join(VAULT, "Orthobullets");

/**
 * Rebuild, from disk, the same two lookups the plugin gets from Obsidian's
 * metadata cache: OB topic -> wikilink slug, and slug -> that note's H1.
 */
const obSlug = new Map<string, string>();
const toDescriptor = new Map<string, string[]>();

for (const name of readdirSync(MCQ_DIR)) {
	if (!name.endsWith(".md")) continue;
	const content = readFileSync(join(MCQ_DIR, name), "utf8");
	if (name.startsWith("OB")) {
		const tag = /^#OB #[\w&/-]+ #([\w&/-]+)/m.exec(content);
		const slug = /^Topic: \[\[([^\]]+)\]\]/m.exec(content);
		if (tag && slug) obSlug.set(tag[1], slug[1]);
	} else {
		const tag = /^#TO #[\w&/-]+ #([\w&/-]+)/m.exec(content);
		if (!tag) continue;
		const chapter = chapterLine(content) ?? "";
		const list = toDescriptor.get(tag[1]) ?? [];
		if (!list.includes(chapter)) list.push(chapter);
		toDescriptor.set(tag[1], list);
	}
}

const headings = new Map<string, string>();
for (const name of readdirSync(OB_DIR)) {
	if (!name.endsWith(".md")) continue;
	const first = readFileSync(join(OB_DIR, name), "utf8").split("\n")[0] ?? "";
	if (first.startsWith("# ")) headings.set(basename(name, ".md"), first.slice(2).trim());
}

/** The same tiered resolution the plugin performs, over the whole corpus. */
function resolveAll(): Map<string, string> {
	const labels = new Map<string, string>();
	for (const [tag, slug] of obSlug) {
		const label = labelFromHeading(tag, headings.get(slug));
		if (label) labels.set(tag, label);
	}
	for (const [tag, descriptors] of toDescriptor) {
		if (labels.has(tag)) continue;
		for (const descriptor of descriptors.slice().sort()) {
			const label = labelFromDescriptor(tag, descriptor);
			if (label) {
				labels.set(tag, label);
				break;
			}
		}
	}
	return labels;
}

const allTopics = new Set([...obSlug.keys(), ...toDescriptor.keys()]);
const labels = resolveAll();

describe("topic labelling over the real corpus", () => {
	it("sees the expected corpus shape", () => {
		expect(allTopics.size).toBe(761);
		expect(obSlug.size).toBe(761);
		expect(toDescriptor.size).toBe(420);
		expect(headings.size).toBeGreaterThan(1000);
	});

	it("labels at least 759 of the 761 topics", () => {
		expect(labels.size).toBeGreaterThanOrEqual(759);
		expect(allTopics.size - labels.size).toBeLessThanOrEqual(2);
	});

	it("never produces a label that does not reconstruct its tag", () => {
		// This is the assertion that makes a wrong name impossible. A label may
		// carry a stopword the tag omits, or be justified by a trailing acronym,
		// so the check is labelMatchesTag rather than raw string equality.
		const bad: string[] = [];
		for (const [tag, label] of labels) {
			if (!labelMatchesTag(tag, label)) bad.push(`${tag} -> ${label}`);
		}
		expect(bad.slice(0, 10)).toEqual([]);
		expect(bad.length).toBe(0);
	});

	it("rejects a plausible-looking name that belongs to a different tag", () => {
		expect(labelMatchesTag("acltear", "ACL Tear")).toBe(true);
		expect(labelMatchesTag("complicationsthr", "Complications of THR")).toBe(true);
		expect(labelMatchesTag("scfe", "Slipped Capital Femoral Epiphysis (SCFE)")).toBe(true);
		expect(labelMatchesTag("acltear", "ACL Reconstruction")).toBe(false);
		expect(labelMatchesTag("arthroplastytemplating", "Anatomy, Biomechanics and Templating")).toBe(
			false,
		);
	});

	it("resolves the named examples", () => {
		expect(labels.get("acltear")).toBe("ACL Tear");
		expect(labels.get("anklearthrodesis")).toBe("Ankle Arthrodesis");
		expect(labels.get("tkacoronalplanebalancing")).toBe("TKA Coronal Plane Balancing");
		expect(labels.get("slippedcapitalfemoralepiphysisscfe")).toBe(
			"Slipped Capital Femoral Epiphysis (SCFE)",
		);
	});

	it("keeps acronym casing that a naive splitter would mangle", () => {
		expect(labels.get("glenohumeralinternalrotationdeficitgird")).toBe(
			"Glenohumeral Internal Rotation Deficit (GIRD)",
		);
		expect(labels.get("developmentaldysplasiaofthehipddh")).toBe(
			"Developmental Dysplasia of the Hip (DDH)",
		);
		expect(labels.get("acarthritis")).toBe("AC Arthritis");
	});

	it("refuses a descriptor that is merely the surrounding chapter", () => {
		// 'arthroplastytemplating' lives under 'Anatomy, Biomechanics and
		// Templating', which says nothing about the tag.
		expect(labels.has("arthroplastytemplating")).toBe(false);
	});
});

describe("pure helpers", () => {
	it("normalises away case, punctuation and ampersands", () => {
		expect(normalizeTopic("Adult Limb Deformity & Correction")).toBe(
			"adultlimbdeformityandcorrection",
		);
		expect(normalizeTopic("Adhesive Capsulitis (Frozen Shoulder)")).toBe(
			"adhesivecapsulitisfrozenshoulder",
		);
	});

	it("strips the section prefix and a stray .docx from a descriptor", () => {
		expect(chapterOf("Arthritis MCQs — Inflammatory and Miscellaneous Arthritis")).toBe(
			"Inflammatory and Miscellaneous Arthritis",
		);
		expect(chapterOf("Spine MCQs — Atlantoaxial Instability.docx")).toBe(
			"Atlantoaxial Instability",
		);
	});

	it("takes only the leading span that reconstructs the tag", () => {
		expect(
			alignDescriptor("3dprinting", "3D Printing in Orthopaedics and Patient Specific Implants"),
		).toBe("3D Printing");
		expect(alignDescriptor("distalbicepstear", "Distal Biceps Tear")).toBe("Distal Biceps Tear");
		expect(alignDescriptor("arthroplastytemplating", "Anatomy, Biomechanics and Templating")).toBe(
			null,
		);
	});

	it("tidies a span that stopped inside a bracket", () => {
		expect(alignDescriptor("anatomyknee", "Anatomy ( Knee )")).toBe("Anatomy (Knee)");
		expect(alignDescriptor("spineanatomy", "Spine (Anatomy)")).toBe("Spine (Anatomy)");
	});

	it("skips a stopword only when the tag omits it", () => {
		expect(alignDescriptor("complicationsthr", "Complications of THR")).toBe(
			"Complications of THR",
		);
		// ...but a tag that does contain the word still aligns.
		expect(alignDescriptor("complicationsofthr", "Complications of THR")).toBe(
			"Complications of THR",
		);
	});

	it("rejects a heading that does not belong to the tag", () => {
		expect(labelFromHeading("acltear", "ACL Tear")).toBe("ACL Tear");
		expect(labelFromHeading("acltear", "PCL Tear")).toBe(null);
		expect(labelFromHeading("acltear", "")).toBe(null);
		expect(labelFromHeading("acltear", undefined)).toBe(null);
	});
});

describe("hand-written topic names", () => {
	it("covers every tag the vault cannot name, and nothing fictional", () => {
		const unknown = Object.keys(TOPIC_NAMES).filter((t) => !allTopics.has(t));
		expect(unknown).toEqual([]);

		const stillRaw = [...allTopics].filter((t) => !labels.has(t) && !(t in TOPIC_NAMES));
		expect(stillRaw).toEqual([]);
	});

	it("names all 761 topics between the two sources", () => {
		const named = [...allTopics].filter((t) => t in TOPIC_NAMES || labels.has(t));
		expect(named.length).toBe(761);
	});

	it("never leaves a name blank or equal to its raw tag", () => {
		const bad = Object.entries(TOPIC_NAMES).filter(
			([tag, name]) => name.trim() === "" || name === tag,
		);
		expect(bad).toEqual([]);
	});

	it("covers only the tags the vault cannot name", () => {
		// Every Target Ortho topic now folds into an Orthobullets one, so the
		// hand-written names are down to the two Orthobullets pages whose H1
		// does not reconstruct their tag.
		expect(Object.keys(TOPIC_NAMES).sort()).toEqual([
			"medbulletsonboardingdrafthtml",
			"otherpathologytopics",
		]);
	});
});
