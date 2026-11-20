#!/usr/bin/env python3
"""Add ?v=<hash> to site.css / site.js / quote app files in every page, so browsers fetch the new
version right after a change even though these files are cached for a year (see _headers).
Run from the repo root after editing CSS/JS:  python3 docs/tools/stamp_assets.py
"""
import hashlib, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
def h(p): return hashlib.md5((ROOT / p).read_bytes()).hexdigest()[:8]
V = {'assets/site.css': h('assets/site.css'), 'assets/site.js': h('assets/site.js'),
     'quote/app.css': h('quote/app.css'), 'quote/app.js': h('quote/app.js')}
pages = ['index.html', 'quote/index.html'] + [str(p.relative_to(ROOT)) for p in ROOT.glob('*/index.html') if p.parent.name not in ('quote', 'docs')]
for page in sorted(set(pages)):
    f = ROOT / page; s = f.read_text(); o = s
    for asset, ver in V.items():
        name = asset.split('/')[-1]
        folder = asset.split('/')[0]
        # match "assets/site.css", "../assets/site.css", or (inside quote/) "app.css"
        s = re.sub(r'((?:\.\./)?' + (re.escape(asset) if page.count('/') == 0 or folder == 'assets' else re.escape(name)) + r')(\?v=[0-9a-f]+)?(")',
                   lambda m: m.group(1) + '?v=' + ver + m.group(3), s)
    if s != o: f.write_text(s); print('stamped', page)
