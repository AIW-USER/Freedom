/**
 * Hand-written topic names.
 *
 * Most of the 761 topic tags are named automatically from the vault — an OB
 * question's `Topic:` wikilink leads to an Orthobullets note whose H1 is already
 * display-quality. These are the rest: tags whose source had no usable name, plus
 * names that were deliberately overridden. Written by hand, so they take
 * precedence over anything derived.
 */
export const TOPIC_NAMES: Record<string, string> = {
	medbulletsonboardingdrafthtml: "Med-Bullets",
	otherpathologytopics: "Other Pathology Topics",
};
