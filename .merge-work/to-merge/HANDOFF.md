# Handoff — merge `TO notes/` facts into `Revision Notes/`

Vault: `/Users/phaneendra/Freedom` (git, branch `main`). Read `CLAUDE.md` there first.
Scratch folder (everything below lives here): `/private/tmp/claude-501/-Users-phaneendra-Freedom/52100922-69d4-4415-a39f-e06229abb4e8/scratchpad/to-merge/`
Approved plan: `/Users/phaneendra/.claude/plans/check-additional-notes-that-crystalline-fountain.md`

## Goal (user's request)
260 lecture notes in `TO notes/Notes — *.md` (images in `TO notes/attachments/`) hold tested facts that the obito revision notes lack. For each note: find the matching `Revision Notes/<Section>/<Topic>.md` chapter(s), add any missing fact in obito house style, or create a new obito-style chapter when no match exists.

User decisions: added facts are tagged **(TO)** · conflicts are written both ways, `**X** (Orthobullets) · **Y** (TO) — read the options` · suspicious TO figures are kept and flagged inline as `(TO — verify: usual …)` · git baseline first · rebuild the PDFs of changed sections.

## Rules
- House style: `~/.claude/skills/obito/SKILL.md`. Merge rules: `INSTRUCTIONS.md` (this folder).
- Never edit `MCQ/`, `Orthobullets/`, `Campbell/`, `Green/`, `TO notes/`, `Question Modules.md`. No Campbell/Green facts.
- Commits: leave out `.obsidian/*`, `.DS_Store`, `Revision Notes/.build/` and the unrelated plugin changes already in the working tree. End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't spawn subagents unless the user asks.

## Done
- Baseline commit `93321e769` ("Baseline: revision notes + TO notes before merge"). `git diff 93321e769 -- "Revision Notes"` shows every change made since.
- **Section merge: all 260 notes processed** by 10 section agents (each wrote only in its own folder). There's one log per section, `log-<Section>.md`, with per-note entries, `## FLAGS` and `## CROSS-SECTION`. About 260 chapter files changed (uncommitted).
- Pilot examples to copy the style from: `Trauma/Acetabular Fractures.md`, `Spine/Ankylosing Spondylitis.md`, `Basic Science/Brain Anatomy.md`.
- **New chapters (untracked):** Basic Science/Brain Anatomy, Cerebral Vascular Malformations, Occlusive Cerebrovascular Disease, Cranial Nerves (moved from Hand; subtitle `*Basic Science · TO notes*`); Pathology/Tuberculosis of Hip; Pediatrics/Cleft Foot (Lobster Foot); Shoulder & Elbow/Basic Arthroscopic Instrumentation; Trauma/Ilizarov Principles.

## Unfinished: cross-section blocks (facts for chapters outside the source agent's section)
Procedure: `XSEC-INSTRUCTIONS.md`. Sources: the `## CROSS-SECTION` part of each `log-*.md`; `xsec-Pediatrics.md` (same as the Pediatrics log; apply once); `xs-Hand.md` (Hand's outbound blocks); `../se-work/cross.md` (Shoulder & Elbow).

| Target group | Status |
|---|---|
| Hand (targets in `Hand/`) | **Done**, see `xapplied-hand.md` |
| Trauma | **Partial**: user stopped it at "Talar neck + Talus other". No xapplied log |
| Basic Science + Pathology + Recon | **Partial**: stopped before "Osteoid Osteoma" and "Metastatic Disease of Spine". No log |
| Pediatrics + Spine + Knee & Sports + Foot & Ankle + Shoulder & Elbow | **Partial**: stopped at "Hip Septic Arthritis". No log |
| Hand's 32 outbound blocks (`xs-Hand.md`) → Trauma, Pediatrics, S&E, Basic Science, F&A | **Not started** |

The user stopped the three partial appliers on purpose. **Ask the user before resuming cross-section work.** If they want it resumed: because the work stopped partway, check every block against the target chapter before inserting it (the dedupe rule) so nothing is added twice.

## Remaining steps
1. **Cross-section** (only if the user wants it; see above).
2. **Verify changed chapters** with a light checker script: image paths resolve (`../../TO notes/attachments/…`), no `[[wikilinks]]`/URLs/callouts/nested bullets, every `✗ Wrong options` line follows a cue line ending in `\`, tables have header rows. `verify.py` needs MCQ bundles, so it's not suitable here. Known items:
   - `Spine/Scheuermann's Kyphosis.md` ~line 58: detached ✗ line (it was already there before the merge).
   - Trauma agent warned its Python inserts may have overwritten concurrent edits. Diff the Trauma chapters against `log-Trauma.md`.
   - Basic Science: Statistic Definitions, Orthopaedic Implants and Nonunion and Bone Defects lack the trailing page-break div (the assembler adds it).
   - Tell the user: Boyd amputation. The existing "Chopart / Boyd" row is probably wrong. The TO note defines Boyd as talectomy + calcaneotibial fusion.
3. **Rebuild the PDFs** for each changed section (all 10):
   ```sh
   S="Trauma"   # each section
   python3 "<scratch>/to-merge/assemble_section.py" "$S"        # → Revision Notes/.build/$S.md (TO chapters last)
   python3 ~/.claude/skills/obito/scripts/build_pdf.py "Revision Notes/.build/$S.md" "Revision Notes/$S.pdf"   # check the script's usage first
   mv "Revision Notes/$S.pdf" "Revision Notes/$S/$S.pdf"
   python3 ~/.claude/skills/obito/scripts/check_tables.py "Revision Notes/$S/$S.pdf"   # must say: split across pages: none
   pdftoppm -png -r 60 -f N -l N …   # spot-check new tables and images
   ```
   The build file must sit in `Revision Notes/.build/` so that `../../TO notes/…` resolves to the vault root.
4. **Commit** the `Revision Notes/` md + pdf files: "Merge TO lecture-note facts into revision notes".
5. **Final report to the user**: notes processed (260), chapters edited, the 8 new chapters, totals of conflicts and flags (collect from the `## FLAGS` sections of the logs plus `flags-Hand.md` and `../se-work/flags.md`), cross-section status, and the Boyd item.

## Totals so far (from the agents' reports, approximate)
Facts added ≈ 3,200 · conflicts ≈ 200 · flags ≈ 66 · cross-section blocks ≈ 170.
