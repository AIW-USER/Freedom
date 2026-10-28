import re, glob, os, sys
# Assemble Revision Notes/<Section>/*.md (one chapter per file) into Revision Notes/.build/<Section>.md
R = "/Users/phaneendra/Freedom/Revision Notes"
SECTION = sys.argv[1]
rows = []
for p in glob.glob(f"{R}/{SECTION}/*.md"):
    t = open(p).read().strip()
    title = t.split("\n", 1)[0].lstrip("# ").strip()
    m = re.search(r"^\*[^*\n]+·\s*(\d+)\s*/\s*(\d+)\*\s*$", t, re.M)
    key = (0, int(m.group(1)), title) if m else (1, 0, title)   # TO-notes chapters go last, by title
    idx = f"{m.group(1)} / {m.group(2)}" if m else "TO notes"
    if not t.endswith("</div>"): t += '\n\n<div style="page-break-after: always;"></div>'
    rows.append((key, title, idx, t))
rows.sort(key=lambda r: r[0])
n_to = sum(1 for r in rows if r[2] == "TO notes")
toc = "\n".join(f"| {i+1} | {r[1]} | {r[2]} |" for i, r in enumerate(rows))
head = f"""# {SECTION} — Revision Notes

*MCQ-focused · Orthobullets + OB/TO question explanations + TO lecture notes · {len(rows)} chapters ({n_to} from TO notes)*

| # | Chapter | Section index |
|---|---|---|
{toc}

**Every chapter, same order:** 1 Basics → 2 Mechanism → 3 Presentation → 4 Diagnosis & Classification → 5 Management → 6 Complications → X vs Y → How it's asked

**Always included where sources have them:** criteria (diagnostic, operative) · genes & lab markers · key radiology findings

**Key:** **TO** = Target Ortho fact (must-know) · ↑ increased · ↓ decreased · → leads to / then · ✗ Wrong options = MCQ distractors · ✓ correct answer · "TO — verify" = TO figure that differs from standard teaching

<div style="page-break-after: always;"></div>

"""
body = "\n\n".join(r[3] for r in rows)
body = re.sub(r'\n*<div style="page-break-after: always;"></div>\s*$', "\n", body)
os.makedirs(f"{R}/.build", exist_ok=True)
open(f"{R}/.build/{SECTION}.md", "w").write(head + body)
print(SECTION, "chapters", len(rows), "TO-notes chapters", n_to)
