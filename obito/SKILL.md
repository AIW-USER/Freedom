---
name: obito
description: Build MCQ-focused orthopaedic revision notes from the Freedom vault. Each Orthobullets topic note plus its OB/TO question explanations becomes one fact-dense chapter, written to a fixed template (Cornell cue lines, comparison tables, 2–3-level flowcharts, every classification, "How it's asked"). The notes are written as Markdown first and then typeset into a monochrome print PDF with an "active space" margin. Use whenever the user asks for revision notes, study notes, a revision book or PDF for a topic or section (Hand, Trauma, Spine…), or says "obito", even without naming the skill. Facts from Campbell/ and Green/ are excluded.
---

# obito — MCQ revision notes → print PDF

The vault is `/Users/phaneendra/Freedom` (layout is in its CLAUDE.md). There are two sources for each topic:
- `Orthobullets/<slug>.md`: the topic note. Images are in `Orthobullets/attachments/`.
- Every MCQ for the topic, OB and TO. Images are in `MCQ/attachments/`. They are grouped by **module** in `Question Modules.md`: 761 topics, 2,981 modules, arranged in sections.

Never use facts from `Campbell/` or `Green/`. Never edit `MCQ/`, `Orthobullets/` or `Question Modules.md`.

Output goes to `Revision Notes/<Section>.md`, for example `Hand.md` or `Shoulder & Elbow.md`, with `<Section>.pdf` beside it. Use one file per section. The section name is the `## …` heading in `Question Modules.md`.

Scripts are in `scripts/` next to this file (`S=~/.claude/skills/obito/scripts`). Use a session scratchpad for bundles.

## Workflow

1. **Scope.** Agree which topics to cover: named slugs, or a whole section. For a first run, or after any template change, do a 3–5 topic pilot first and get the user's sign-off.
2. **Bundles.**
   - Run `python3 $S/build_bundles.py <scratch>/bundles <slug …>` or `--section Hand`. It prints `slug section n/total mcqs bytes`.
   - Each bundle holds the Orthobullets note, then each module with its MCQs. TO questions come first and are tagged `[TO – MUST]`.
   - For long bundles, run `python3 $S/compact.py <bundle> > x.mcq.txt`. It removes citation paragraphs and figure captions from the MCQ part, which cuts about 40%.
   - Read the Orthobullets part of each bundle in full.
3. **Write each chapter** using the template and rules below. Append chapters in **section order**, i.e. the topic's n in `n/total`.
4. **Verify.** Run `python3 $S/verify.py "Revision Notes/<Section>.md" <scratch>/bundles`.
   - It reports missing images, links, nested bullets, and MCQs whose answer words are missing.
   - Review every `CHECK` line by hand. Most are abbreviations (FCR, APB). For any that is a real omission, add the fact.
5. **PDF.** Build it straight after verifying. Do not ask for approval first. Then give the user both files together.
   - Run `python3 $S/build_pdf.py "Revision Notes/<Section>.md" "Revision Notes/<Section>.pdf"`, then `python3 $S/check_tables.py "Revision Notes/<Section>.md"`. The second script must report `split across pages: none`.
   - Render a few pages with `pdftoppm -r 60 -png -f A -l B …` and look at them: image sizes, flowcharts, empty pages.
   - Build output goes to `Revision Notes/.build/` (greyscale image cache and `last.html`). That folder is hidden in Obsidian.
6. **Rollout of a full section** (only if the user agrees to parallel agents):
   1. Build bundles with `--section`. Save the printed lines as `<work>/index.txt`, because `assemble.py` reads the expected topics and their `n/total` from it.
   2. Split the topics into about 10 batches balanced by bundle bytes. Give each agent the skill path, a finished reference chapter, its batch file, and these instructions: write `<work>/chapters/<NNN>-<slug>.md`, one chapter per file, ending with the page-break div; check images with `ls`; do not edit the vault.
   3. Put any chapters you write yourself into the same `chapters/` folder. Then run `python3 $S/assemble.py <work> "<Section>"`. It writes `Revision Notes/<Section>.md` with the title, a contents table of every chapter, and all chapters in section order, and reports any missing slugs.
   4. Run steps 4 and 5 on the merged file. Agents report conflicts they flagged and cross-chapter mismatches (e.g. different NCS cut-offs in two notes). Reconcile those in the chapters by stating both values.

**Known pitfalls (already handled in the scripts; keep them handled):**
- **Broken images.** Some vault "images" are saved HTML pages. `verify.py` lists them as unreadable and `build_pdf.py` skips them. Remove the line from the notes.
- **Symbols.** Avenir Next has no glyphs for → ✗ ✓ ↑ ↓ ♀ ♂ or fractions. The CSS falls back to Menlo, then Apple Symbols. Keep that stack on every font declaration, or WeasyPrint pulls in large system fonts.
- **Dotted or dashed borders.** WeasyPrint draws these as thousands of tiny circles, which made the PDF 44 MB instead of 10 MB. Use only solid rules.
- **Contents table.** It is the only table allowed to break across pages (class `contents`). `check_tables.py` ignores it.
- **Size.** Expect about 4–5 pages per topic and about 10 MB for a 100-topic section.
## Fact selection (the core of the job)

- **Priority:**
  1. Target Ortho (TO) explanations. These are MUST: put in every fact and mark it **(TO)**.
  2. OB explanations, including their "Incorrect Answers" lines, which supply the ✗ traps.
  3. The Orthobullets note.
- **The cut test.** Before writing a fact, ask three questions. Is it tested? Does it separate similar options ("X vs Y")? Is it a classic association? If the answer to all three is no, cut it. Ruthless cutting does most of the work.
- Every MCQ's correct answer must be traceable to a line in its chapter.
- Mirror how questions are asked. Use EXCEPT/NOT-true traps, "next step", "most specific/sensitive", "complication of the indicated surgery", and numbers that appear in the options.
- **When sources disagree** (OB vs TO vs Orthobullets), state both values and their sources, e.g. `**2:1** (Orthobullets) · **10:1** (TO sources) — read the options`. Never silently pick one.
- **Always include these three in every chapter, when the sources have them.** Give each its own `###` block, in the stage shown, and use a table where it fits:
  1. **Criteria** (diagnostic, operative, admission, return-to-play, fixation, and so on), under 4 Diagnosis & Classification or 5 Management. Copy thresholds exactly, e.g. "ORIF if displacement >1 mm · intrascaphoid angle >35°", "MCP ≥30° or any PIP contracture".
  2. **Important genes & lab markers**, under 1 Basics or 4 Diagnosis: inheritance pattern, gene/mutation (e.g. FGFR3, COL1A1), cytokines, serum/urine labs and their direction (↑ ALP, ↓ phosphate), and histology markers.
  3. **Key radiology findings**, under 4 Diagnosis: the views to order, the classic sign or measurement for each modality (X-ray, CT, MRI, US, bone scan), and the "best/most sensitive test" facts.
  If the sources have nothing for one of the three, leave that block out. Never invent content to fill it.
- Include **all classifications**, each as a table. Add the Orthobullets classification images in a cell where they exist.
- Do not reword away numbers or eponyms. Keep cut-offs exact (>1 mm, 20° ulnar deviation, DML >4.5 ms).

## Chapter template (same order in every chapter; leave out empty stages)

```markdown
# <Topic title>

*<Section> · <n> / <total>*

## 1 Basics                       ← epidemiology, anatomy, pathophysiology
### <Module name or concept>      ← module subheadings (wording from Question Modules.md, may be trimmed)
**Cue** — terse fragment → fragment, **bold key term**
### Genes & lab markers           ← ALWAYS (here or in stage 4) when the sources have any

## 2 Mechanism
## 3 Presentation
## 4 Diagnosis & Classification
### Key radiology findings        ← ALWAYS: views, sign per modality, best test
### Diagnostic criteria           ← ALWAYS when criteria exist (table)
### <Classification>              ← every classification as a table
## 5 Management                   ← algorithms, then one ### per management module
### Operative criteria            ← ALWAYS when indications/thresholds exist (table)
## 6 Complications
## X vs Y                         ← side-by-side comparison tables of commonly confused things
## How it's asked
**"Stem pattern?"** → **answer**\
✗ Wrong options: distractor · distractor

<div style="page-break-after: always;"></div>
```

- Put each module under the stage it fits best. Non-module concepts (Anatomy, Epidemiology) also get a `###`.
- The book file starts with a title, `# <Section> — Revision Notes`, then an italic line, a contents table (`| # | Chapter | Section index |`), the stage order and a symbol key. After that comes a page-break div. The PDF fills in page numbers in the contents table automatically when the Chapter cell text equals the H1 exactly.

## Writing rules

- **No sentences and no nested bullets.** Every fact is one paragraph line: `**Cue** — fragment`. Use a blank line between lines, with the cue on the left and the fragments on the right.
- Use arrows ↑ ↓ →, standard abbreviations, ✓ for correct ones, and **bold** for key terms.
- **✗ means one thing only: wrong MCQ options.** Write them once per list, labelled, on their own line after the answer: end the cue line with `\`, then `✗ Wrong options: a · b · c` (give a reason in brackets, `excision (< 25%)`). Where a new line is impossible (table cells, several lists on one line, facts that follow the list) write `(✗ Wrong options: a · b)` inline. Never use ✗ to mean "not", "no", "avoid" or "contraindicated" — write the word. In yes/no tables write Yes / No.
- **Tables wherever possible.** Use them for classifications, thresholds (e.g. degree of deformity → treatment), test vs fact asked, rates, and X vs Y.
- **Algorithms** combine treatment options, operative criteria and deciding factors. Each one is at most 2–3 levels deep; split a larger one into several. Write them as a fenced code block in this exact tree syntax, which the PDF builder draws as a flowchart:
  ```
  Root decision
  ├─ condition → ACTION
  │      (optional italic note line)
  └─ condition → ACTION
         └─ sub-condition → ACTION
  ```
  Level-1 branches start at column 0. Level-2 branches start at column 7: indent with `│      ` (bar + 6 spaces) or 7 spaces. Text after the last `→` is bolded.
- **Images.** Include only high-yield ones: classification images, radiographs, labelled anatomy, signs. Place each next to the fact it shows. Use standard Markdown with a relative path and a caption as the alt text: `![Z deformity forces](../MCQ/attachments/q3669-illa-zigzag-deformity-cmc.jpg)`. Use 2–5 per chapter. Copy useful tables from the source as Markdown tables.
- **No links.** No wikilinks, no URLs, no `Topic:`/`Source:` lines.
- "How it's asked" lines must start with `**"`. Put **one question per line**; never join two with ` · `.
- Keep the notes as plain Markdown. Use no callouts, and no HTML apart from the page-break div.

## PDF style (in `print.css`; change it there, not per document)

- **Page:** A4, single column, monochrome for black-and-white printing. Images are converted to greyscale before they go in.
- **Margins:** chapter pages have a wide outer margin labelled "– – Active space – –". It mirrors between left and right pages, so it stays on the outside when printed double-sided. The **title and contents pages have no active space**: `build_pdf.py` wraps everything before the first chapter H1 (and the hidden `#sec` marker) in `<div class="front">`, which prints on the named page `front` with even 18 mm margins. Keep `#sec` inside that div, or page 1 comes out blank.
- **Headers and footers:** the running header shows the section on left pages and the chapter on right pages. Page numbers are at the bottom outer corner, with a centred footer.
- **Fonts:** Baskerville uppercase centred chapter title with `— Section · n / total —` beneath it. Avenir Next for the body (never a handwritten font).
- **Headings:** each stage gets a black number block and a heavy rule. Each module subheading is underlined across the full page width.
- **Tables:** grey header row, thin black borders, and **never split across pages**.
- **Pages and images:** each chapter starts on a new page. Figures are capped at 80 × 55 mm, and images in table cells at 30 × 26 mm.

## Conventions the build depends on (keep them or the PDF breaks)

| Markdown | Rendered as |
|---|---|
| `**Cue** — text` (em dash) | Two-column cue line |
| `**"Stem?"** → answer` | Two-column question/answer row |
| `## 3 Presentation` | Numbered stage heading |
| `*Hand · 6 / 103*` right after the H1 | Centred subtitle |
| First H1 | Book title; later H1s are chapters (each starts a new page and sets the running header) |
| Code block in tree syntax | Drawn flowchart |
| Image alone on its line | Figure with caption |
