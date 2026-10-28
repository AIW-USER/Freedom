/**
 * Reads `Question Modules.md`: concept modules, each a list of question ids.
 *
 *   ## Trauma
 *   ### [[acetabular-fractures|Acetabular Fractures]] (OB 87 · TO 4)
 *   - **Letournel classification** (OB 16): [[OB505]], [[OB759]], …
 *
 * Pure — no Obsidian import. Anything that is not a section heading, a topic
 * heading or a module line is ignored, so prose and jump links are harmless.
 */

export interface ModuleDef {
	/** `<topic slug>::<module name>` — stable across edits that do not rename the module. */
	key: string;
	section: string;
	topicSlug: string;
	topicLabel: string;
	name: string;
	/** Question ids (file basenames) in the order written. */
	ids: string[];
	/** Position in the file, for "in file order" placement. */
	order: number;
}

const RE_SECTION = /^##[ \t]+(.+?)[ \t]*$/;
const RE_TOPIC_LINK = /^###[ \t]+\[\[([^|\]]+)(?:\|([^\]]*))?\]\]/;
const RE_TOPIC_PLAIN = /^###[ \t]+(.+?)[ \t]*(?:\([^)]*\))?[ \t]*$/;
const RE_MODULE = /^[-*][ \t]+\*\*(.+?)\*\*[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*(.*)$/;
const RE_LINK = /\[\[([^\]|#^]+?)(?:[|#^][^\]]*)?\]\]/g;

export function moduleKey(topicSlug: string, name: string): string {
	return `${topicSlug}::${name}`;
}

export function parseModules(text: string): ModuleDef[] {
	const out: ModuleDef[] = [];
	let section = "";
	let topicSlug = "";
	let topicLabel = "";

	for (const raw of text.split("\n")) {
		const line = raw.trimEnd();
		if (line.startsWith("### ")) {
			const link = RE_TOPIC_LINK.exec(line);
			if (link) {
				topicSlug = link[1].trim();
				topicLabel = (link[2] ?? "").trim() || topicSlug;
			} else {
				const plain = RE_TOPIC_PLAIN.exec(line);
				topicLabel = plain ? plain[1] : line.slice(4).trim();
				topicSlug = topicLabel;
			}
			continue;
		}
		const sec = RE_SECTION.exec(line);
		if (sec && line.startsWith("## ")) {
			section = sec[1];
			continue;
		}
		const mod = RE_MODULE.exec(line);
		if (mod && topicSlug) {
			const ids = [...mod[2].matchAll(RE_LINK)].map((m) => m[1].trim());
			const name = mod[1].trim();
			out.push({
				key: moduleKey(topicSlug, name),
				section,
				topicSlug,
				topicLabel,
				name,
				ids,
				order: out.length,
			});
		}
	}
	return out;
}
