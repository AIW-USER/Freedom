"""Write one source bundle per topic: Orthobullets note + every MCQ grouped by module (TO first).
Usage: build_bundles.py <out_dir> <slug|--section NAME> [...]
Prints: slug, section, n/total, MCQ count, bundle bytes."""
import re, sys, os
V = "/Users/phaneendra/Freedom"
out_dir, args = sys.argv[1], sys.argv[2:]
os.makedirs(out_dir, exist_ok=True)
qm = open(f"{V}/Question Modules.md").read()
parts = re.split(r"^## (.+)$", qm, flags=re.M)
order, topics, by_section = {}, {}, {}
for i in range(1, len(parts), 2):
    name, body = parts[i].strip(), parts[i + 1]
    ts = re.findall(r"^### \[\[([^|\]]+)\|([^\]]+)\]\]", body, re.M)
    by_section[name] = [s for s, _ in ts]
    for n, (s, t) in enumerate(ts, 1):
        order[s] = (name, n, len(ts), t)
    for blk in re.split(r"^### ", body, flags=re.M)[1:]:
        m = re.match(r"\[\[([^|\]]+)\|", blk)
        if not m: continue
        mods = re.findall(r"^- \*\*(.+?)\*\* \(([^)]*)\): (.+)$", blk, re.M)
        topics[m.group(1)] = [(mn, c, re.findall(r"\[\[(\w+)\]\]", ids)) for mn, c, ids in mods]
slugs = []
it = iter(args)
for a in it:
    slugs += by_section[next(it)] if a == "--section" else [a]
def mcq(i):
    t = open(f"{V}/MCQ/{i}.md").read()
    return re.sub(r"^(# .*|#\w.*|Topic:.*|Source:.*|Exam:.*)\n", "", t, flags=re.M).strip()
for s in slugs:
    sec, n, tot, title = order[s]
    o = [f"# BUNDLE: {title}  ({sec} {n}/{tot})\n", "=== ORTHOBULLETS NOTE ===\n",
         open(f"{V}/Orthobullets/{s}.md").read(), "\n=== MODULES & MCQs ===\n"]
    for mn, c, ids in topics[s]:
        o.append(f"\n##### MODULE: {mn} ({c})\n")
        for i in sorted(ids, key=lambda x: not x.startswith("TO")):
            o.append(f"\n---- {i} {'[TO – MUST]' if i.startswith('TO') else '[OB]'}\n{mcq(i)}\n")
    p = f"{out_dir}/{s}.md"
    open(p, "w").write("\n".join(o))
    print(s, sec, f"{n}/{tot}", sum(len(x[2]) for x in topics[s]), os.path.getsize(p))
