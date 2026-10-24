#!/usr/bin/env python3
"""Extract text from published PDFs in the documents table -> data/chat/pdf-text.json (read by src/chat/sources.js).
usage: python3 scripts/extract-pdfs.py   (re-run when documents change; then restart the server)"""
import json, re, sqlite3, sys
from pathlib import Path
from pypdf import PdfReader
root = Path(__file__).resolve().parent.parent
db = sqlite3.connect(root / 'data/sdca.db')
rows = db.execute("SELECT slug,title_en,title_zh,category,school_year,file_path FROM documents WHERE published=1").fetchall()
def school_year_start(text, doc_year):
    """Start year of the school year a PDF is about: 'School Year 2020-2021' in its text, else its first mm/dd/yyyy date, else the documents.school_year value."""
    head = text[:800]
    m = re.search(r'(20\d\d)\s*[-–/]\s*(?:20)?\d\d', head)
    if m: return int(m.group(1))
    m = re.search(r'(\d{1,2})/(\d{1,2})/(20\d\d)', text)
    if m: return int(m.group(3)) if int(m.group(1)) >= 7 else int(m.group(3)) - 1
    m = re.match(r'\s*(20\d\d|19\d\d)', doc_year or '')
    return int(m.group(1)) if m else None

out, empty = [], []
for slug, te, tz, cat, yr, fp in rows:
    p = root / fp
    if not p.exists() or p.suffix.lower() != '.pdf': continue
    try:
        text = '\n'.join((pg.extract_text() or '') for pg in PdfReader(str(p)).pages)
    except Exception as e:
        empty.append((slug, f'error {e}')); continue
    text = re.sub(r'[ \t]+', ' ', text); text = re.sub(r'\n{2,}', '\n', text).strip()
    if len(text) < 80: empty.append((slug, f'{len(text)} chars (scanned?)')); continue
    out.append({'slug': slug, 'title_en': te, 'title_zh': tz, 'category': cat, 'year': yr, 'school_year_start': school_year_start(text, yr), 'file': fp, 'text': text})
(root / 'data/chat').mkdir(parents=True, exist_ok=True)
(root / 'data/chat/pdf-text.json').write_text(json.dumps(out, ensure_ascii=False))
print(f'extracted {len(out)} PDFs, {sum(len(d["text"]) for d in out)} chars; skipped {len(empty)}')
for s in empty: print('  skipped', *s)
