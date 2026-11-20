#!/usr/bin/env python3
"""Rebuild sitemap-pages.xml (pages + their photos for Google Images) and sitemap.xml
(a sitemap index pointing to sitemap-pages.xml and blog/sitemap.xml, which the Blog tab updates).

Run from the repo root:  python3 docs/tools/build_sitemap.py
Re-run after adding pages or changing photos.
"""
import datetime, html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = 'https://portfolio.theunposedstory.workers.dev/'
PAGES = [('', '1.0'), ('wedding-photography/', '0.8'), ('pre-wedding-shoot/', '0.8'),
         ('cinematic-wedding-films/', '0.8'), ('haldi-bridal-photography/', '0.8')]
SKIP = re.compile(r'(logo|favicon|icon-|apple-touch)', re.I)
today = datetime.date.today().isoformat()

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
       '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
total = 0
for path, prio in PAGES:
    src = (ROOT / path / 'index.html').read_text()
    seen, imgs = set(), []
    for tag in re.findall(r'<img\b[^>]*>', src):
        full = re.search(r'data-full="([^"]+)"', tag) or re.search(r'\ssrc="([^"]+)"', tag)
        if not full: continue
        u = full.group(1).replace('../', '').replace('-sm.webp', '.webp')
        if not u.startswith('assets/img/') or SKIP.search(u) or u in seen: continue
        seen.add(u)
        alt = re.search(r'alt="([^"]*)"', tag)
        imgs.append((BASE + u, html.unescape(alt.group(1)) if alt else ''))
    out.append('  <url>')
    out.append(f'    <loc>{BASE}{path}</loc><lastmod>{today}</lastmod><priority>{prio}</priority>')
    for u, t in imgs[:30]:
        out.append(f'    <image:image><image:loc>{html.escape(u)}</image:loc></image:image>')
    out.append('  </url>')
    total += len(imgs[:30])
    print(f'{path or "/":28} {len(imgs[:30])} photos')
out.append('</urlset>')
(ROOT / 'sitemap-pages.xml').write_text('\n'.join(out) + '\n')
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f'  <sitemap><loc>{BASE}sitemap-pages.xml</loc><lastmod>{today}</lastmod></sitemap>\n'
    f'  <sitemap><loc>{BASE}blog/sitemap.xml</loc></sitemap>\n</sitemapindex>\n')
print('sitemap-pages.xml written:', len(PAGES), 'pages,', total, 'photo entries')
