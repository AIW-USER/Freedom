# Apply cross-section items

Section agents merged TO lecture notes into `/Users/phaneendra/Freedom/Revision Notes/<Section>/*.md` and left facts for chapters in OTHER sections as "CROSS-SECTION" blocks (target path, heading to insert under, exact Markdown lines). Your job: insert the blocks whose target is in YOUR target folders.

Read first: `~/.claude/skills/obito/SKILL.md` (writing rules) and `INSTRUCTIONS.md` in this folder (the merge rules: (TO) tag, conflicts stated both ways, "(TO — verify: …)" flags).

## Sources (scratch dir = this folder's parent)
- `to-merge/log-*.md` — the `## CROSS-SECTION` part of each (except log-Hand.md / xs-Hand.md / flags-Hand.md — the Hand agent is still running; skip those)
- `to-merge/xsec-Pediatrics.md` — same content as log-Pediatrics CROSS-SECTION; use whichever is complete, never apply twice
- `se-work/cross.md` — Shoulder & Elbow items (also summarised in log-Shoulder & Elbow.md; apply once)

## Rules
- Only edit files inside your target folders. Never edit TO notes/, MCQ/, Orthobullets/; no git.
- Before inserting each line, check the target chapter: if the fact is already present (two source agents can send the same fact, e.g. FAI from Recon and Pediatrics; also the target's own section agent may already have added it), skip or merge it into the existing line. No duplicates.
- Insert under the named heading; if missing, put it under the best-fitting stage / `###`. Keep obito style: cue lines with blank lines between, `✗ Wrong options` directly after its cue line (ending `\`), tables with header rows, How-it's-asked lines start `**"`.
- Where an inserted value contradicts the chapter, write both: `**X** (Orthobullets) · **Y** (TO) — read the options`. Keep any "(TO — verify: …)" flags.
- Use Edit or careful Python with unique anchors; after editing a file, re-read the changed region to confirm no table/✗ pair was broken.
- Image lines: path `../../TO notes/attachments/<file>`; verify it exists.

## Output
Write `to-merge/xapplied-<your group>.md`: per target file, blocks applied / skipped as duplicate / conflicts added. Final reply: counts per target section and any blocks you could not place.
