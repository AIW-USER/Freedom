# Merge TO lecture-note facts into obito revision notes

Vault: `/Users/phaneendra/Freedom`. Read first, in full:
- `~/.claude/skills/obito/SKILL.md` — house style, writing rules, chapter template (follow exactly).
- Reference chapters already merged (look at how `(TO)` facts were added): `Revision Notes/Spine/Ankylosing Spondylitis.md`, `Revision Notes/Trauma/Acetabular Fractures.md`; and a new chapter built from a TO note: `Revision Notes/Basic Science/Brain Anatomy.md`.

## Inputs
- Your batch file lists TO notes (filenames inside `TO notes/`). Images are in `TO notes/attachments/`.
- Revision chapters: `Revision Notes/<Section>/<Topic>.md` (one chapter per file).

## For each TO note in your batch
1. Read the TO note in full.
2. Find matching chapter(s): filename match in your section folder first, then `grep -ril` of distinctive terms (eponyms, classification names, signs) across `Revision Notes/*/*.md`. A note may map to several chapters. Read each matching chapter fully before editing.
3. Compare fact by fact. A fact is **additional** if its number / cut-off, eponym, classification grade, sign, test, indication, drug, or X-vs-Y distinction is not already in the chapter. Apply the obito cut test (tested? separates options? classic association?). Skip faculty quotes, anecdotes, course announcements, generic prose.
4. Add each new fact at the right stage / `###` in house style, ending with **(TO)**:
   - Cue lines `**Cue** — fragment (TO)`; no sentences, no nested bullets, no links/wikilinks/URLs, no callouts.
   - Prefer extending existing table rows/new table rows; new classifications as tables; algorithms in the tree syntax (≤ 3 levels).
   - ✗ only for wrong MCQ options.
   - Add 1–2 `**"…?"** → **answer** (TO)` lines to "How it's asked" for the TO note's explicit exam pearls / MCQs, one question per line.
   - **Conflicts**: never overwrite. State both: `**X** (Orthobullets) · **Y** (TO) — read the options`.
   - **Suspicious figures**: if a TO figure looks wrong versus standard teaching (likely typo/error), keep it but flag: `**> 2 cm** (TO — verify: usual normal ≥ 5 cm)`. Also list it in your log under FLAGS.
   - Do not reword or delete existing content.
5. Images: only high-yield ones (classification, radiograph, sign, labelled anatomy), max ~2 per note, as `![caption](../../TO notes/attachments/<file>.jpg)` on its own line next to the fact. Verify each with `ls` and `file` (must be a real image).
6. **No matching chapter** (topic genuinely not covered anywhere): create `Revision Notes/<your section>/<Topic Title>.md` following the full obito template (stages, X vs Y, How it's asked when supported), subtitle line `*<Section> · TO notes*`, ending with `<div style="page-break-after: always;"></div>`. Several TO notes on one uncovered topic → one chapter. If the topic is partly covered, prefer adding to existing chapters over creating a new one.

## Ownership (important — other agents run in parallel)
- You may write ONLY inside `Revision Notes/<your section>/`.
- Facts belonging to a chapter in another section folder: do NOT edit it. Put them in your log under CROSS-SECTION with the target file path and the exact Markdown lines to insert and where (heading to insert under).
- Never edit `TO notes/`, `MCQ/`, `Orthobullets/`, `Campbell/`, `Green/`, `Question Modules.md`. No git commands. No facts from Campbell/Green.

## Log
Write `<scratch>/to-merge/log-<section>.md`:
```
## <TO note filename>
- chapters: <files edited or created> | facts added: N | conflicts: N
- notes: (or "no new facts")
## FLAGS
- <file> — <figure> — reason
## CROSS-SECTION
### <target path> — under "<heading>"
<exact lines>
```
Final reply: totals (notes processed, chapters edited, chapters created with names, facts added, conflicts, flags, cross-section items).
