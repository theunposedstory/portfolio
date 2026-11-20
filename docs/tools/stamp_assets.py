#!/usr/bin/env python3
"""Add ?v=<hash> to site.css / site.js / quote app files in every page, so browsers fetch the new
version right after a change even though these files are cached for a year (see _headers).
Run from the repo root after editing CSS/JS:  python3 docs/tools/stamp_assets.py
(Also stamps blog posts and quote/blog-chrome.js, which the Blog tab uses for new posts.)
"""
import hashlib, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
def h(p): return hashlib.md5((ROOT / p).read_bytes()).hexdigest()[:8]
# blog chrome (JSON strings): "css": "assets/site.css?v=..."
f = ROOT / 'quote/blog-chrome.js'; s = f.read_text(); o = s
for asset in ('assets/site.css', 'assets/site.js'):
    s = re.sub(re.escape(asset) + r'(\?v=[0-9a-f]+)?"', asset + '?v=' + h(asset) + '"', s)
if s != o: f.write_text(s); print('stamped quote/blog-chrome.js')

V = {'assets/site.css': h('assets/site.css'), 'assets/site.js': h('assets/site.js'),
     'quote/app.css': h('quote/app.css'), 'quote/app.js': h('quote/app.js'),
     'quote/blog.js': h('quote/blog.js'), 'quote/blog-chrome.js': h('quote/blog-chrome.js')}
SKIP = ('quote', 'docs', 'node_modules', '.git')
pages = ['index.html', 'quote/index.html'] + [str(p.relative_to(ROOT)) for p in ROOT.glob('**/index.html')
                                              if p.relative_to(ROOT).parts[0] not in SKIP]
for page in sorted(set(pages)):
    f = ROOT / page; s = f.read_text(); o = s
    for asset, ver in V.items():
        name = asset.split('/')[-1]
        folder = asset.split('/')[0]
        # match "assets/site.css", "../assets/site.css", "../../assets/site.css" or (inside quote/) "app.css"
        s = re.sub(r'((?:\.\./)*' + (re.escape(asset) if page.count('/') == 0 or folder == 'assets' else r'(?<![\w-])' + re.escape(name)) + r')(\?v=[0-9a-f]+)?(")',
                   lambda m: m.group(1) + '?v=' + ver + m.group(3), s)
    if s != o: f.write_text(s); print('stamped', page)

