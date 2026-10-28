# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

An Obsidian vault of orthopaedic study material, versioned with git. Almost everything is Markdown content. The only code is a custom Obsidian plugin, `.obsidian/plugins/mcq-scheduler`.

| Folder | Contents | Produced by |
|---|---|---|
| `MCQ/` | 12,528 single-question notes: `OB<n>.md` (9,786, from Orthobullets) and `TO<n>.md` (2,742, from another question bank). Images are in `MCQ/attachments/`. | Bulk import, then scripted edits |
| `Orthobullets/` | One note per Orthobullets topic, `<slug>.md`, with a sibling `<slug>.json` holding the raw scrape (`title`, `url`, `sections`, `gallery`, …). Images are named `ob<topicId>-<desc>.jpg`. | The `Bullets extraction` skill (Playwright) |
| `Campbell/` | `Chapter N - Title.md`, faithful transcriptions of Campbell's Operative Orthopaedics. Images are in `attachments/Chapter N Images/`. | The `cbell-mkdn` skill |
| `Green/` | `Green ChNN Title.md`, transcriptions of Green's Operative Hand Surgery. Images are in `Attachments/`. | The `greens-mkdn` skill |

Textbook chapters are verbatim transcriptions. Do not reword them.

## MCQ note format (the parser's contract)

Both banks share one syntax, documented for people in `MCQ syntax.md` at the vault root (`test/syntax.test.ts` parses its worked example). The parser accepts nothing else. `test/corpus.test.ts` checks the whole bank, so any bulk edit to `MCQ/` must keep this shape:

```
# OB1                                   ← H1 must equal the file basename
#OB #kneesports #acltear [#AAOS]        ← one tag line: source code FIRST (OB, TO, or any 2–5 letters), then section, topic
Topic: [[acl-tear]]                     ← optional fields, only these four: wikilink to Orthobullets/<slug>.md
Exam: 2005 Practice Test | Question 40
Source: https://www.orthobullets.com/…
Chapter: Arthritis MCQs — …             ← TO notes; feeds TO topic labels

## Question                             ← images inline here
## Options                              ← "1. text", numbered 1..n with no gaps
## Correct option                       ← "**2. text**" or "Not provided by the source."
## Answer explanation                   ← TO explanations may end "Answer: 2"
## Illustrations                        ← optional
```

- `family` is the source tag, read by position, not the filename prefix. TO notes were normalised to this shape on 25 Sep 2026: letters renumbered a→1, the descriptor moved to `Chapter:`, `## Question images` merged into `## Question`, and `Answer: B` rewritten to `Answer: 2`. About 60 TO explanations still mention the old letters in prose.
- **Rebuild index** (the pane's ↻ button, the settings button, or the command) calls `plugin.rebuildAndCheck()`. It rebuilds from the metadata cache, then parses every note and names any that break the syntax.
- Topic tags are unified across the two banks: every TO note carries an Orthobullets topic tag and that topic's section, so the scheduler lists exactly the 761 Orthobullets topics. Synonymous TO tags were renamed (`#acl` → `#acltear`); broad TO chapters were placed question by question. `src/topic-aliases.ts` folds any old tag that went wholly to one topic; `test/aliases.test.ts` fails if a note carries an old tag or a topic has only TO questions. When adding TO notes, tag them with the closest Orthobullets topic.
- Section tags are listed in `SECTIONS` / `SECTION_ALIASES` in `src/types.ts`. The match ignores case (`#Shoulderelbow` and `#shoulderelbow` both work). The first tag that is not a section or meta tag is taken as the topic.
- Keep the notes plain Markdown. Answers used to be wrapped in `> [!success]-` callouts, and those callouts were removed on purpose. A corpus test fails if any callout appears again.
- Recent content edits work through the whole bank with a script, then commit, for example italicising cited studies in OB explanations (`*Chhabra et al. performed…*`).

## mcq-scheduler plugin

Commands run from `.obsidian/plugins/mcq-scheduler/`:

```sh
npm run build        # tsc type-check + esbuild → main.js (main.js is committed; rebuild after editing src/)
npm run dev          # esbuild watch mode
npm test             # all vitest suites
npm run validate     # corpus.test.ts only — run after any bulk edit to MCQ/
npx vitest run test/topics.test.ts -t "normalises"   # a single test
```

Tests read the real vault from the hard-coded path `/Users/phaneendra/Freedom/MCQ` (and `Orthobullets/`). They also assert exact counts: the 12,528 total, the OB/TO split, the per-section distribution, the 95 unanswered TO notes, and 761 topics. If you add or remove notes on purpose, update those numbers in the tests.

### Architecture

- **The plugin never writes to notes.** The one exception is `MCQ activity.md` at the vault root. "Start monitoring" creates it once from the template in `activity.ts`, and the plugin never rewrites it, so the user edits its goals and dates. Hiding answers only affects rendering. `sections.ts` defines the policy: `## Options` and `## Correct option` are always hidden in reading view (`always`), and `## Answer explanation` and `## Illustrations` are hidden until the question is answered (`answer`). `reading.ts` is a synchronous markdown post-processor that adds `mcq-hidden` to each block before it goes into the DOM, so hidden content never flashes on screen. `reveal.ts` keeps an in-memory, session-only record of the one revealed question, so moving to the next question hides the last one again. `styles.css` does the actual hiding. Source mode shows everything.
- **Two ways notes are read.** `index.ts` builds a lightweight index (section/topic/family per note) from Obsidian's metadata cache, which covers all 12k notes cheaply. `parser.ts` (`parseMcq`) reads one file's full text when a question opens. The index tests check that both agree for every note.
- **Topic labels** (`topics.ts`). A compressed tag such as `acltear` gets a display name from three sources, in order: hand-written `topic-names.ts`, then the H1 of the Orthobullets note that the OB `Topic:` link points to, then the TO descriptor line. A candidate is used only if `normalizeTopic(candidate) === tag`, so a label can never be wrong. If no candidate matches, the raw tag is shown.
- The pure modules (`parser`, `sections`, `index`, `topics`, `callouts`) import only *types* from `obsidian`, so vitest can run them outside the app. Keep it that way.
- **Module schedule** (the pane's **Modules** mode). `modules.ts` parses `Question Modules.md`: 2,981 modules, keyed `<topic slug>::<module name>`. The format is documented in the module-syntax part of `README.md`, whose worked example is parsed by `test/syntax.test.ts`. `test/modules.test.ts` checks the file covers all 12,528 questions once. `schedule.ts` is pure, Anki-style spaced repetition with **the module as the card**: each visit asks one question and is rated Skip/Hard/Good/Easy (0–3), scheduled with SM-2 defaults (learning steps 1 m/10 m, graduate 1 d, easy 4 d, ease 2.5, min 1.3). A visit asks an unseen TO question, then unseen OB, then the weakest (lowest last rating). New modules come from the queue head, `newPerDay` (20) a day, interleaved with due reviews; study days start at `dayStartHour` (4); "Start tomorrow's modules" sets `aheadDay`. Mature (all questions seen, interval ≥ 21 d) counts as completed. `schedule-store.ts` keeps state in `schedule.json` (version 2; a version 1 file is migrated on load) and appends every rating to `responses.jsonl`, both in the plugin folder rather than the vault. Modules new to the file wait for you to place them.
- **Progress bars** (`src/progress/`, absorbed from the user's Progress Keeper plugin, which must stay disabled because both register the `progress` code block). `progress` and `progress-heatmap` blocks work in any note, and the syntax is documented in `Progress bars.md`. A bar with `source: mcq-solved | mcq-time | modules-completed` takes its number from the scheduler: `activity-log.ts` and `schedule-store.ts` log events, merged per hour, into `progress.json` in the plugin folder. Other bars use the number typed in the note. `parse.ts`, `bars.ts`, `history.ts` and `settings.ts` are pure. The status-bar pins live in `settings.progress`.
- `view.ts` is the side-pane UI: Browse (Sections → Topics → Questions, with search) and Modules. `settings.ts` and `data.json` hold user settings (`mcqFolder`, `hideInReadingView`, `optionScale`, …).

## Git

- Commit messages are either short descriptions or timestamp checkpoints (`22 sep 2026 20:28`).
- `.obsidian/workspace.json` appears in `.gitignore` but is still tracked, so it often shows as modified. Leave it out of commits unless asked.
