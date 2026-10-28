"""Shorten a bundle's MCQ part for reading: inside answer explanations, drop citation
paragraphs (lines starting with a single *) and Figure/Illustration captions. Stems,
options and correct options are kept intact. Usage: compact.py <bundle.md>"""
import re, sys
t = open(sys.argv[1]).read()
head, mcq = t.split("=== MODULES & MCQs ===", 1)
out, sec = [], ""
for line in mcq.split("\n"):
    s = line.strip()
    if s.startswith("## ") or s.startswith("---- ") or s.startswith("##### "): sec = s
    expl = sec.startswith("## Answer explanation") or sec.startswith("## Illustrations")
    if not s or s == "## Illustrations": continue
    if expl and s.startswith("*") and not s.startswith("**"): continue
    if expl and re.match(r"^(Figures?|Illustrations?) [A-Z]", s): continue
    if re.match(r"^\*(Figure|Illustration) [A-Z]\*$", s) or s.startswith("[Illustration"): continue
    out.append(line)
print("\n".join(out))
