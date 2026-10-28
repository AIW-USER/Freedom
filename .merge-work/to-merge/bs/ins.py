# usage: python3 ins.py target.md edits.txt
# edits file: blocks separated by lines '@@@'; each block: first line MODE (AFTER|BEFORE), then ANCHOR line(s) until line '>>>', then text to insert
import sys
path, ed = sys.argv[1], sys.argv[2]
s = open(path, encoding='utf-8').read()
blocks = open(ed, encoding='utf-8').read().split('\n@@@\n')
for b in blocks:
    if not b.strip(): continue
    mode, rest = b.split('\n', 1)
    if mode.strip() == 'END':
        s = s.rstrip('\n') + '\n\n' + rest.split('\n>>>\n',1)[1].rstrip('\n') + '\n'
        continue
    anchor, text = rest.split('\n>>>\n', 1)
    n = s.count(anchor)
    if n != 1:
        sys.exit(f"anchor count {n}: {anchor[:80]!r}")
    text = text.rstrip('\n')
    if mode.strip() == 'AFTER':
        s = s.replace(anchor, anchor + '\n\n' + text, 1)
    elif mode.strip() == 'BEFORE':
        s = s.replace(anchor, text + '\n\n' + anchor, 1)
    else:
        sys.exit('bad mode ' + mode)
open(path, 'w', encoding='utf-8').write(s)
print('ok', path)
