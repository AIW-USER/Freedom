import sys, re
# usage: apply.py target.md spec.txt
# spec blocks:
# @@AFTER <exact full line>     -> insert block after that line (blank line before block)
# @@AFTERBLOCK <exact full line> -> insert after the contiguous non-blank block (e.g. table/code) starting at/containing that line
# @@BEFORE <exact full line>
# @@REPLACE <exact full line>   -> next block content replaces the line
# block content until line '@@END'
target, spec = sys.argv[1], sys.argv[2]
lines = open(target, encoding='utf-8').read().split('\n')
sp = open(spec, encoding='utf-8').read().split('\n')
ops = []
i = 0
while i < len(sp):
    l = sp[i]
    if l.startswith('@@'):
        kind, _, anchor = l[2:].partition(' ')
        body = []
        i += 1
        while sp[i] != '@@END':
            body.append(sp[i]); i += 1
        ops.append((kind, anchor, body))
    i += 1
for kind, anchor, body in ops:
    idx = [k for k, x in enumerate(lines) if x == anchor]
    if len(idx) != 1:
        print('ANCHOR FAIL (%d): %s' % (len(idx), anchor)); sys.exit(1)
    k = idx[0]
    if kind == 'REPLACE':
        lines[k:k+1] = body
    elif kind == 'AFTER':
        lines[k+1:k+1] = [''] + body
    elif kind == 'AFTERBLOCK':
        e = k
        while e + 1 < len(lines) and lines[e+1].strip() != '':
            e += 1
        lines[e+1:e+1] = [''] + body
    elif kind == 'BEFORE':
        lines[k:k] = body + ['']
    else:
        print('bad kind', kind); sys.exit(1)
open(target, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok', len(ops), 'ops')
