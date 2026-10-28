# usage: python3 ins.py <file> <spec>   spec: blocks separated by lines "@@@ AFTER <anchor-line-substring>" / "@@@ BEFORE <substr>"; text follows
import sys
p,spec=sys.argv[1],open(sys.argv[2]).read()
s=open(p).read()
lines=s.split("\n")
blocks=[]
cur=None
for l in spec.split("\n"):
    if l.startswith("@@@ "):
        mode,anchor=l[4:].split(" ",1)
        cur=[mode,anchor,[]]; blocks.append(cur)
    elif cur: cur[2].append(l)
for mode,anchor,body in blocks:
    while body and body[-1]=="": body.pop()
    idx=[i for i,l in enumerate(lines) if anchor in l]
    if len(idx)!=1: sys.exit(f"anchor matches {len(idx)}: {anchor}")
    i=idx[0]
    if mode=="AFTER":
        lines[i+1:i+1]=[""]+body
    else:
        lines[i:i]=body+[""]
open(p,"w").write("\n".join(lines))
print("ok",len(blocks))
