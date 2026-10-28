"""Check a revision-notes file. Usage: verify.py <notes.md> <bundles_dir> [slug ...]
Reports missing images, links, nested bullets, and MCQs whose correct-option words
are mostly absent (review those by hand — abbreviations cause false alarms)."""
import re, os, sys, glob
F, B, only = sys.argv[1], sys.argv[2], set(sys.argv[3:])
t = open(F).read(); low = t.lower(); base = os.path.dirname(os.path.abspath(F))
imgs = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", t)
from PIL import Image
def bad(i):
    q = os.path.normpath(os.path.join(base, i))
    if not os.path.exists(q): return True
    try: Image.open(q).verify(); return False
    except Exception: return True
print("images:", len(imgs), "missing/unreadable:", [i for i in imgs if bad(i)])
print("wikilinks:", t.count("[["), "| urls:", len(re.findall(r"https?://", t)),
      "| nested bullets:", len(re.findall(r"^\s+[-*] ", t, re.M)))
stop = set("the a an of and or to in with for on at by is are be as from that this which its not no all above none".split())
tot = weak = 0
for b in sorted(glob.glob(f"{B}/*.md")):
    if only and os.path.basename(b)[:-3] not in only: continue
    s = open(b).read().split("=== MODULES & MCQs ===")[1]
    for m in re.finditer(r"---- (\w+) .*?## Correct option\s+\*\*\d+\.\s*(.+?)\*\*", s, re.S):
        tot += 1
        w = [x for x in re.findall(r"[a-z0-9]+", m.group(2).lower()) if x not in stop and len(x) > 2]
        if w and sum(x in low for x in w) / len(w) < 0.6:
            weak += 1; print(f"  CHECK {m.group(1)}: {m.group(2)[:90]}")
print("mcqs:", tot, "| to review:", weak)
