"""Confirm no table is split across pages. Run after build_pdf.py. Usage: check_tables.py <notes.md>"""
import os, sys
from weasyprint import HTML, CSS
d = os.path.dirname(os.path.abspath(sys.argv[1]))
here = os.path.dirname(os.path.abspath(__file__))
doc = HTML(filename=os.path.join(d, ".build", "last.html"), base_url=d).render(stylesheets=[CSS(os.path.join(here, "print.css"))])
seen = {}
def walk(box, pg):
    if getattr(box, "element_tag", None) == "table" and "contents" not in (box.element.get("class") or ""):
        seen.setdefault(id(box.element), set()).add(pg)
    for c in getattr(box, "children", None) or []: walk(c, pg)
for i, p in enumerate(doc.pages): walk(p._page_box, i + 1)
split = sorted(sorted(v) for v in seen.values() if len(v) > 1)
print("pages:", len(doc.pages), "| tables:", len(seen), "| split across pages:", split or "none")
