"""Revision Notes markdown -> print PDF (monochrome). Usage: build.py <in.md> <out.pdf>"""
import re, sys, html, subprocess, os
from weasyprint import HTML, CSS

src, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
section = os.path.splitext(os.path.basename(src))[0]
body = subprocess.run(["pandoc", "-f", "gfm", "-t", "html", "--wrap=none", src], capture_output=True, text=True, check=True).stdout
# pandoc appends U+FE0E (text presentation) to symbols like ↔; no font has the pair → tofu box
body = body.replace("︎", "")

# --- page-break divs: chapters break via CSS instead
body = re.sub(r'<div style="page-break-after: always;">\s*</div>', "", body)

# --- first h1 = book title, later h1 = chapters (+ subtitle line)
first = True
def h1(m):
    global first
    cls = "book" if first else "chapter"
    first = False
    return f'<h1 id="{m.group(1)}" class="{cls}">{m.group(2)}</h1>'
body = re.sub(r'<h1 id="([^"]*)">(.*?)</h1>', h1, body)
body = re.sub(r'(</h1>)\s*<p><em>(.*?)</em></p>', r'\1<p class="sub">\2</p>', body)

# --- TOC: link chapter names, add page numbers via target-counter
chapters = dict((html.unescape(t), i) for i, t in re.findall(r'<h1 id="([^"]*)" class="chapter">(.*?)</h1>', body))
def tocrow(m):
    name = html.unescape(m.group(2))
    if name in chapters:
        return f'{m.group(1)}<a class="toc" href="#{chapters[name]}">{m.group(2)}</a>{m.group(3)}'
    return m.group(0)
body = re.sub(r'(<td>)([^<]+)(</td>)', tocrow, body)

body = body.replace('<table>', '<table class="contents">', 1)

# --- h2 "1 Basics" -> numbered block
body = re.sub(r'<h2 id="([^"]*)">(\d+)\s+(.*?)</h2>', r'<h2 id="\1"><span class="num">\2</span>\3</h2>', body)

# --- cue lines:  **Cue** — text   -> Cornell grid
NP = r'(?:(?!</p>).)*?'
NS = r'(?:(?!</strong>).)*?'
body = re.sub(rf'<p><strong>({NS})</strong>\s*—\s*({NP})</p>',
              r'<p class="cue"><span class="k">\1</span><span class="v">\2</span></p>', body, flags=re.S)
# --- "How it's asked":  **"stem"** → answer
body = re.sub(rf'<p><strong>((?:&quot;|“|"){NS})</strong>\s*→\s*({NP})</p>',
              r'<p class="ask"><span class="q">\1</span><span class="a">\2</span></p>', body, flags=re.S)

# --- standalone images -> figures with caption
body = re.sub(r'<p><img src="([^"]+)" alt="([^"]*)"\s*/?></p>',
              r'<figure><img src="\1" alt="\2"/><figcaption>\2</figcaption></figure>', body)

# --- images: greyscale + downscale copies (monochrome print)
from PIL import Image
gdir = os.path.join(os.path.dirname(os.path.abspath(out)), ".build", "gray"); os.makedirs(gdir, exist_ok=True)
srcdir = os.path.dirname(os.path.abspath(src))
def gray(m):
    p = os.path.normpath(os.path.join(srcdir, html.unescape(m.group(1))))
    q = os.path.join(gdir, os.path.splitext(os.path.basename(p))[0] + ".jpg")
    if not os.path.exists(q):
        try:
            im = Image.open(p).convert("L"); im.thumbnail((900, 900)); im.save(q, quality=70, optimize=True)
        except Exception:
            print("SKIPPED unreadable image:", p); return 'src="" data-bad="1"'
    return f'src="file://{q}"'
body = re.sub(r'src="([^"]+)"', gray, body)

body = re.sub(r'<figure><img src="" data-bad="1"[^>]*/><figcaption>.*?</figcaption></figure>', '', body)
body = re.sub(r'<img src="" data-bad="1"[^>]*/?>', '', body)

# --- ASCII decision trees in code blocks -> drawn flowcharts
def tree(m):
    lines = html.unescape(m.group(1)).rstrip("\n").split("\n")
    root, nodes = lines[0], []          # nodes: [depth, text, notes]
    for ln in lines[1:]:
        b = next((i for i, c in enumerate(ln) if c in "├└"), None)
        if b is None:                   # continuation note
            nodes[-1][2].append(ln.strip(" │"))
            continue
        nodes.append([b // 7 + 1, ln[b:].lstrip("├└─ ").strip(), []])
    def fmt(t):
        t = html.escape(t)
        if "→" in t:
            a, b = t.rsplit("→", 1)
            t = f'<span class="cond">{a.strip()}</span><span class="arr">→</span><b>{b.strip()}</b>'
        return t
    out, cur = [f'<div class="flow"><div class="root">{html.escape(root)}</div>'], 0
    for d, t, notes in nodes:
        if d > cur: out.append("<ul>" * (d - cur))
        else: out.append("</li>" + "</ul></li>" * (cur - d))
        cur = d
        note = "".join(f'<div class="note">{html.escape(n)}</div>' for n in notes)
        out.append(f'<li><div class="node">{fmt(t)}{note}</div>')
    out.append("</li>" + "</ul></li>" * (cur - 1) + "</ul></div>")
    return "".join(out)
body = re.sub(r'<pre><code>(.*?)</code></pre>', tree, body, flags=re.S)

SEC = f'<div id="sec">{html.escape(section)}</div>'   # sets string(sec) for running heads
# --- front matter (title + contents) prints on "front" pages: no active-space margin
i = body.find('class="chapter"')
if i != -1:
    i = body.rfind("<h1", 0, i)
    body = f'<div class="front">{SEC}{body[:i]}</div>{body[i:]}'
else:
    body = SEC + body

doc = f'''<!doctype html><html><head><meta charset="utf-8"><title>{section} — Revision Notes</title></head>
<body data-section="{html.escape(section)}">{body}</body></html>'''
open(os.path.join(os.path.dirname(gdir), "last.html"), "w").write(doc)
HTML(string=doc, base_url=os.path.dirname(os.path.abspath(src))).write_pdf(
    out, stylesheets=[CSS(os.path.join(here, "print.css"))])
print("wrote", out)
