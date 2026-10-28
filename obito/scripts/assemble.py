import re, glob, os
import sys
H, SECTION = sys.argv[1], sys.argv[2]   # work dir (chapters/, index.txt), section name
files = sorted(glob.glob(f"{H}/chapters/*.md"), key=lambda p: os.path.basename(p))
chs, toc, missing = [], [], []
expected = [l.split() for l in open(f"{H}/index.txt")]
have = {re.match(r"\d+-(.+)\.md", os.path.basename(p)).group(1): p for p in files}
for row in expected:
    # section names may contain spaces ("Shoulder & Elbow"), so find n/total by pattern
    slug, nt = row[0], next(x for x in row if re.fullmatch(r"\d+/\d+", x))
    if slug not in have: missing.append(slug); continue
    t = open(have[slug]).read().strip()
    title = t.split("\n", 1)[0].lstrip("# ").strip()
    if not t.endswith("</div>"): t += '\n\n<div style="page-break-after: always;"></div>'
    chs.append(t); toc.append(f"| {len(toc)+1} | {title} | {nt.replace('/', ' / ')} |")
head = f"""# {SECTION} — Revision Notes

*MCQ-focused · Orthobullets + OB/TO question explanations · {len(chs)} of {len(expected)} topics*

| # | Chapter | Section index |
|---|---|---|
""" + "\n".join(toc) + """

**Every chapter, same order:** 1 Basics → 2 Mechanism → 3 Presentation → 4 Diagnosis & Classification → 5 Management → 6 Complications → X vs Y → How it's asked

**Always included where sources have them:** criteria (diagnostic, operative) · genes & lab markers · key radiology findings

**Key:** **TO** = Target Ortho fact (must-know) · ↑ increased · ↓ decreased · → leads to / then · ✗ Wrong options = MCQ distractors · ✓ correct answer

<div style="page-break-after: always;"></div>

"""
# last chapter needs no trailing page break
body = "\n\n".join(chs)
body = re.sub(r'\n*<div style="page-break-after: always;"></div>\s*$', "\n", body)
open(f"/Users/phaneendra/Freedom/Revision Notes/{SECTION}.md", "w").write(head + body)
print("chapters", len(chs), "missing", missing)
