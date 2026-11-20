#!/usr/bin/env python3
"""Build the four service pages from index.html's header/footer + the content below.

Run from the repo root:  python3 docs/tools/build_service_pages.py
Pages are written to <slug>/index.html. Re-run after changing the header, footer or copy.
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = 'https://portfolio.theunposedstory.workers.dev/'
WA = '917045278377'
home = (ROOT / 'index.html').read_text()

def cut(start, end):
    i = home.index(start); j = home.index(end, i) + len(end); return home[i:j]

def rootify(s, R='{{R}}'):
    """Rewrite homepage-relative links so they start with R (e.g. '../' one folder deep)."""
    s = re.sub(r'(src|srcset|href|data-full)="assets/', r'\1="' + R + 'assets/', s)
    s = re.sub(r', assets/', ', ' + R + 'assets/', s)
    s = s.replace('href="./"', 'href="' + R + '"')
    s = re.sub(r'href="(wedding-photography|pre-wedding-shoot|cinematic-wedding-films|haldi-bridal-photography|blog)/"', r'href="' + R + r'\1/"', s)
    s = re.sub(r'href="#(?!")', 'href="' + R + '#', s)
    return s

def up(s):
    """Rewrite homepage-relative links for a page one folder deep."""
    return rootify(s, '../')

HEADER = up(cut('<header class="hdr">', '</header>') + '\n' + cut('<div class="drawer" id="drawer">', '</div>'))
FOOTER = up(cut('<footer class="ftr">', '</footer>'))
FAB = up(cut('<a class="fab"', '</a>'))
MBAR = up(cut('<nav class="mbar"', '</nav>'))
FIGS = re.findall(r'<figure class="g-item" data-cat="([a-z]+)">.*?</figure>', home, re.S)
FIG_HTML = re.findall(r'(<figure class="g-item" data-cat="[a-z]+">.*?</figure>)', home, re.S)

STEPS = cut('<ol class="steps"', '</ol>')
esc = html.escape

PAGES = [
  dict(slug='wedding-photography', cat='wedding', nav='Wedding Photography',
    title='Candid Wedding Photographer in Mumbai | The Unposed Story',
    desc='Candid and traditional wedding photography in Mumbai by Sandip Lade. Every ritual and emotion, across Mumbai, Thane, Navi Mumbai, Pune and destination weddings. From ₹35,000 per day.',
    eyebrow='Candid Wedding Photographer in Mumbai', display='Your wedding, <em>exactly as it felt.</em>',
    lead='Candid and traditional wedding photography by Sandip Lade and team. Every ritual, every glance, every happy tear, across Mumbai, Thane, Navi Mumbai, Pune and destination weddings.',
    hero=('royal-couple-portrait', 733, 1100, 'Bride and groom portrait in a royal palace-style set'),
    answer='The Unposed Story photographs weddings in Mumbai with a candid photographer and a traditional photographer together, so you get natural, emotional moments and complete coverage of rituals and family groups.',
    glance=[('Coverage', 'Candid + traditional photographers, 6 to 14 hours per day'), ('Areas', 'Mumbai, Thane, Navi Mumbai, Pune, pan-India & destination'),
            ('Starting at', '₹35,000 per day (Essential collection)'), ('You receive', '150–700 edited photos, online gallery; albums in Gold & Platinum')],
    included=[('Candid photography', 'Emotional, unposed moments: the laughter, the nerves, the quiet glances.'),
              ('Traditional photography', 'Complete coverage of the stage, rituals, guests and family groups.'),
              ('Every function', 'Haldi, mehendi, sangeet, pheras and reception: each listed with its date, venue and timing.'),
              ('Edited photos & gallery', 'Colour-corrected, retouched photos in an online gallery to share with family.'),
              ('Premium albums', '30-page premium album in Gold; 40-page luxury album in Platinum.'),
              ('Drone coverage', 'Aerial photos and video of the venue and grand entries (Gold, or as an add-on).')],
    faqs=[('How much does a candid wedding photographer cost in Mumbai?', 'Our wedding collections start at ₹35,000 per day for the Essential collection: 6 hours of coverage, one candid and one traditional photographer, 150–200 edited photos and an online gallery. Silver starts at ₹55,000, Gold at ₹85,000 and Platinum at ₹1,35,000. Your final quote depends on dates, hours and venue.'),
          ('Do you shoot candid or traditional wedding photos?', 'Both. Every collection includes a candid photographer for natural, emotional moments and a traditional photographer for rituals, stage and family group photos.'),
          ('How many photos will we receive?', 'It depends on the collection: 150–200 edited photos in Essential, 250–300 in Silver, 400–500 in Gold and 600–700 in Platinum, plus a complete raw image backup.'),
          ('Do you travel outside Mumbai for weddings?', 'Yes. We regularly cover Thane, Navi Mumbai and Pune, and travel across India and abroad for destination weddings. Outstation travel and stay are charged separately.'),
          ('How do we book our wedding date?', 'WhatsApp +91 70452 78377 with your date and city. We confirm availability within 24 hours, send a detailed quotation, and your date is reserved once the booking advance is received.')]),
  dict(slug='pre-wedding-shoot', cat='prewedding', nav='Pre-Wedding Shoots',
    title='Pre-Wedding Shoot in Mumbai | Beach & Fort Shoots | The Unposed Story',
    desc='Relaxed, candid pre-wedding shoots in Mumbai at beaches, heritage forts and golden-hour locations. Included in Platinum or booked on its own. The Unposed Story by Sandip Lade.',
    eyebrow='Pre-Wedding Shoot in Mumbai', display='Your story, <em>before the big day.</em>',
    lead='Relaxed, candid pre-wedding shoots at Mumbai’s beaches, heritage forts and golden-hour spots. No stiff poses, just the two of you being yourselves.',
    hero=('prewedding-beach-sun-flare', 733, 1100, 'Couple laughing during a beach pre-wedding shoot in Mumbai'),
    answer='The Unposed Story plans and shoots candid pre-wedding sessions in and around Mumbai, at beaches, heritage forts and golden-hour locations, with gentle direction instead of stiff posing.',
    glance=[('Locations', 'Beaches, heritage forts and golden-hour spots in and around Mumbai'), ('Price', 'Included in Platinum, or booked separately: quote on request'),
            ('Add-ons', 'Makeup artist, costume styling, extra location, Instagram reel'), ('You receive', 'Edited photos in an online gallery to share')],
    included=[('Location planning', 'We suggest beaches, forts and golden-hour spots that suit your story and outfits.'),
              ('Gentle, candid direction', 'Easy prompts instead of stiff poses, so you look and feel like yourselves.'),
              ('Golden-hour timing', 'Shoots planned around the softest, most flattering light of the day.'),
              ('Styling add-ons', 'Professional makeup artist and costume styling, arranged on request.'),
              ('Extra location', 'Add a second location (say a beach and a fort) for more variety.'),
              ('Instagram reel', 'A short vertical edit to announce your wedding on social media.')],
    faqs=[('How much does a pre-wedding shoot cost in Mumbai?', 'A pre-wedding shoot is included in our Platinum wedding collection. It can also be booked on its own: share your preferred date and locations on WhatsApp and we’ll send a quote.'),
          ('Where can we do a pre-wedding shoot in Mumbai?', 'Our couples love beaches, heritage forts and golden-hour locations in and around Mumbai. We help you choose places that suit your story, outfits and travel time.'),
          ('We are not comfortable posing. Is that a problem?', 'Not at all. Our style is candid: we use simple prompts and let real moments happen, so you never have to hold stiff poses.'),
          ('Can you arrange makeup and outfits?', 'Yes. A professional makeup artist and costume styling are available as add-ons, along with extra locations and an Instagram reel.'),
          ('How do we book a pre-wedding shoot?', 'WhatsApp +91 70452 78377 with your preferred date and locations. We reply within 24 hours with availability and a quotation.')]),
  dict(slug='cinematic-wedding-films', cat='wedding', nav='Cinematic Films',
    title='Cinematic Wedding Films & Videography in Mumbai | The Unposed Story',
    desc='Cinematic wedding films, teasers, highlight films, full event video and Instagram reels in Mumbai, with drone coverage. Photo + video collections from ₹55,000 per day.',
    eyebrow='Cinematic Wedding Films in Mumbai', display='Relive it like <em>your own movie.</em>',
    lead='Cinematic wedding films, teasers and reels that keep the sound, movement and emotion of your day, filmed by our cinematographers alongside our photographers.',
    hero=('wedding-couple-varmala', 733, 1100, 'Bride and groom smiling after the varmala'),
    answer='The Unposed Story films weddings with cinematic and traditional videographers, delivering a short teaser, a 10–25 minute highlight film, full event documentation and Instagram reels.',
    glance=[('Formats', 'Teaser (1–3 min), highlight film (10–25 min), full event video (1–3 hrs), reels'), ('In collections', 'Highlights reel in Silver; cinematic film in Gold & Platinum'),
            ('Starting at', 'Photo + video from ₹55,000 per day'), ('Delivery', 'Google Drive link + USB pen drive')],
    included=[('Cinematic teaser', 'A 1–3 minute trailer made for social media and quick sharing.'),
              ('Highlight film', 'A 10–25 minute story of your day with licensed music and sound design.'),
              ('Full event video', 'Traditional documentation of rituals, stage and speeches (1–3 hours).'),
              ('Instagram reels', 'Vertical 9:16 edits to share your wedding on social media.'),
              ('Drone cinematography', 'Aerial shots of the venue, grand entries and outdoor moments.'),
              ('High-definition footage', 'Creative angles and camera movement, filmed in high definition.')],
    faqs=[('What is the difference between a teaser, a highlight film and a full video?', 'The teaser is a 1–3 minute trailer for social media. The highlight film is a 10–25 minute cinematic story of your day. The full event video is 1–3 hours of traditional documentation of every ritual and speech.'),
          ('Which collections include a wedding film?', 'Silver includes a highlights reel. Gold and Platinum include a full cinematic wedding film, and Gold also includes drone coverage. Reels can be added to any collection.'),
          ('How much does wedding videography cost in Mumbai?', 'Photo + video collections start at ₹55,000 per day (Silver: 2 photographers + 1 videographer). Gold with two cinematographers and a cinematic film starts at ₹85,000 per day.'),
          ('Do you offer drone shots?', 'Yes. Drone aerial coverage is included in Gold and can be added to other collections, subject to venue permissions.'),
          ('How will we receive our films?', 'Final films are delivered through a Google Drive link and on a USB pen drive.')]),
  dict(slug='haldi-bridal-photography', cat='haldi,bridal', nav='Haldi & Bridal',
    title='Haldi, Mehendi & Bridal Portrait Photography in Mumbai | The Unposed Story',
    desc='Candid haldi, mehendi and sangeet photography and relaxed bridal portraits in Mumbai. Rituals full of colour and laughter, photographed by The Unposed Story.',
    eyebrow='Haldi, Mehendi & Bridal Photography in Mumbai', display='The colour, the joy, <em>the bride.</em>',
    lead='Haldi, mehendi and sangeet photographed with all their laughter and colour, plus relaxed bridal portraits that look and feel like you.',
    hero=('bridal-jewellery-portrait', 733, 1100, 'Maharashtrian bride portrait with gold jewellery'),
    answer='The Unposed Story photographs pre-wedding rituals such as haldi, mehendi and sangeet candidly, and creates relaxed bridal portraits in soft light and meaningful locations.',
    glance=[('Rituals', 'Haldi, mehendi, sangeet and every family ceremony'), ('Bridal portraits', 'Soft light, meaningful locations, no forced smiles'),
            ('How it’s booked', 'Each function is added to your wedding quotation'), ('Areas', 'Mumbai, Thane, Navi Mumbai, Pune & destination')],
    included=[('Haldi coverage', 'The turmeric, the teasing and the laughter, captured as it happens.'),
              ('Mehendi & sangeet', 'Details, dances and family moments from every function.'),
              ('Bridal portraits', 'A calm, comfortable session that brings out your energy and jewellery.'),
              ('Family moments', 'Traditional coverage of elders, cousins and group photos.'),
              ('Detail shots', 'Mehendi, jewellery, outfits and décor, beautifully documented.'),
              ('Reels from the rituals', 'Short vertical edits of the colourful moments, as an add-on.')],
    faqs=[('Can you cover our haldi and mehendi as well as the wedding?', 'Yes. Each function (haldi, mehendi, sangeet, wedding and reception) is listed in your quotation with its date, venue and timing, so we plan the right team for every event.'),
          ('Do you do bridal portrait sessions?', 'Yes. We create relaxed bridal portraits in soft light and meaningful locations, with no stiff poses or forced smiles.'),
          ('How are haldi and bridal photos priced?', 'They are part of your wedding collection, which starts at ₹35,000 per day. Extra functions or hours are added to your quote.'),
          ('Will our photos look natural?', 'Our style is candid and emotion-led. We blend in so your family stays present, while we capture the real moments.'),
          ('How do we check availability?', 'WhatsApp +91 70452 78377 with your function dates and city. We reply within 24 hours.')]),
]

def wa(text): return 'https://wa.me/' + WA + '?text=' + re.sub(r'[^A-Za-z0-9]', lambda m: '%%%02X' % ord(m.group()) if ord(m.group()) < 128 else m.group(), text)

def page(p):
    url = BASE + p['slug'] + '/'
    cats = p['cat'].split(',')
    figs = [up(f) for f in FIG_HTML if re.search(r'data-cat="(%s)"' % '|'.join(cats), f)]
    others = [o for o in PAGES if o is not p]
    img, w, h, alt = p['hero']
    schema = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Service', '@id': url + '#service', 'name': p['nav'] + ' in Mumbai', 'serviceType': p['nav'], 'description': p['desc'],
         'provider': {'@id': BASE + '#business'}, 'areaServed': [{'@type': 'City', 'name': n} for n in ['Mumbai', 'Thane', 'Navi Mumbai', 'Pune']],
         'url': url, 'image': BASE + 'assets/img/' + img + '.webp'},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE},
            {'@type': 'ListItem', 'position': 2, 'name': p['nav'], 'item': url}]},
        {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in p['faqs']]}]}
    fonts = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap'
    msg = wa("Hello Sandip, I'd like to check availability for " + p['nav'].lower() + " with The Unposed Story.")
    return f'''<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<script>if(location.hostname==='theunposedstory.github.io'){{location.replace('https://portfolio.theunposedstory.workers.dev'+location.pathname.replace(/^\\/portfolio/,'')+location.search+location.hash)}}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(p['title'])}</title>
<meta name="description" content="{esc(p['desc'])}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#3D4724">
<meta property="og:type" content="website"><meta property="og:site_name" content="The Unposed Story"><meta property="og:locale" content="en_IN">
<meta property="og:title" content="{esc(p['title'])}"><meta property="og:description" content="{esc(p['desc'])}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}assets/img/{img}.webp"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../assets/img/favicon-48.png" sizes="48x48" type="image/png"><link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="{fonts}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="{fonts}"></noscript>
<link rel="preload" as="image" href="../assets/img/{img}.webp" fetchpriority="high">
<link rel="stylesheet" href="../assets/site.css">
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{HEADER}

<main id="main">
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="../">Home</a> <span>/</span> <span aria-current="page">{esc(p['nav'])}</span></nav>
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <h1><span class="eyebrow">{esc(p['eyebrow'])}</span><span class="display">{p['display']}</span></h1>
      <p class="lead">{esc(p['lead'])}</p>
      <div class="cta-row">
        <a class="btn btn-dark" href="{msg}" target="_blank" rel="noopener">Check your date</a>
        <a class="btn btn-line" href="../#packages">See collections</a>
      </div>
    </div>
    <div class="hero-art"><div class="arch"><img src="../assets/img/{img}.webp" srcset="../assets/img/{img}-sm.webp 426w, ../assets/img/{img}.webp {w}w" sizes="(max-width:720px) 100vw, 520px" width="{w}" height="{h}" alt="{esc(alt)}" fetchpriority="high"></div></div>
  </div>
</section>

<section class="glance" aria-labelledby="glance-h">
  <div class="wrap">
    <p id="glance-h">{esc(p['answer'])}</p>
    <dl>{''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in p['glance'])}</dl>
  </div>
</section>

<section class="sec" aria-labelledby="inc-h">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">What’s included</span><h2 class="h2" id="inc-h">Everything you need, <em>nothing forced</em></h2></div></div>
    <div class="incl">{''.join(f'<div class="incl-card rv-in"><h3>{esc(t)}</h3><p>{esc(d)}</p></div>' for t, d in p['included'])}</div>
  </div>
</section>

<section class="sec" id="work" aria-labelledby="work-h" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Recent work</span><h2 class="h2" id="work-h">From our <em>{esc(p['nav'].lower())}</em> stories</h2></div>
      <a class="link" href="../#work">See all work →</a></div>
    <div class="gallery" data-only="{p['cat']}">
{chr(10).join(figs)}
    </div>
  </div>
</section>

<section class="sec process" aria-labelledby="pr-h">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">How it works</span><h2 class="h2" id="pr-h">From hello to <em>heirloom</em></h2></div></div>
    {STEPS}
  </div>
</section>

<section class="sec faq" aria-labelledby="faq-h">
  <div class="wrap faq-grid">
    <div><span class="eyebrow">Good to know</span><h2 class="h2" id="faq-h">{esc(p['nav'])} <em>questions</em></h2>
      <p class="lead" style="margin-top:18px">Can’t find your answer? WhatsApp Sandip. We reply within 24 hours.</p></div>
    <div>{''.join(f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for i, (q, a) in enumerate(p['faqs']))}</div>
  </div>
</section>

<section class="sec related" aria-labelledby="rel-h" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Also by The Unposed Story</span><h2 class="h2" id="rel-h">More ways we <em>tell your story</em></h2></div></div>
    <div class="rel">{''.join(f'<a class="rel-card" href="../{o["slug"]}/"><b>{esc(o["nav"])}</b><span>{esc(o["eyebrow"])}</span></a>' for o in others)}</div>
  </div>
</section>

<section class="sec cta" id="enquire" aria-labelledby="cta-h">
  <div class="wrap cta-grid">
    <div>
      <span class="eyebrow">Reserve your date</span>
      <h2 class="h2" id="cta-h">Let’s begin <em>your story.</em></h2>
      <p class="lead" style="margin-top:18px">Share your date and city. We’ll confirm availability within 24 hours and send a detailed quotation.</p>
    </div>
    <div class="contact-list">
      <a href="{msg}" target="_blank" rel="noopener"><span><small>WhatsApp · fastest reply</small><b>+91 70452 78377</b></span></a>
      <a href="tel:+917045278377"><span><small>Call Sandip</small><b>+91 70452 78377</b></span></a>
      <a href="../#enquire"><span><small>Prefer a form?</small><b>Send an enquiry →</b></span></a>
    </div>
  </div>
</section>
</main>

{FOOTER}

{FAB}
{MBAR}
<script>document.getElementById('yr').textContent=new Date().getFullYear();</script>
<script src="../assets/site.js" defer></script>
</body>
</html>
'''

for p in PAGES:
    d = ROOT / p['slug']; d.mkdir(exist_ok=True)
    (d / 'index.html').write_text(page(p))
    print('wrote', p['slug'] + '/index.html')

# Shared header/footer for blog pages, used by the Blog tab in the builder (quote/blog.js).
# {{R}} = path back to the site root. Published posts pick this up next time they're (re)published.
RAW = lambda a, b: rootify(cut(a, b))
chrome = {
    'header': RAW('<header class="hdr">', '</header>') + '\n' + RAW('<div class="drawer" id="drawer">', '</div>'),
    'footer': RAW('<footer class="ftr">', '</footer>'),
    'fab': RAW('<a class="fab"', '</a>'), 'mbar': RAW('<nav class="mbar"', '</nav>'),
    'css': re.search(r'assets/site\.css(\?v=[0-9a-f]+)?', home).group(0),
    'js': (re.search(r'assets/site\.js(\?v=[0-9a-f]+)?', home) or re.search('assets/site.js', home)).group(0),
    'fonts': 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap',
    'base': BASE,
}
(ROOT / 'quote' / 'blog-chrome.js').write_text('/* Generated by docs/tools/build_service_pages.py from index.html. Do not edit by hand. */\nwindow.TUS_CHROME = ' + json.dumps(chrome, ensure_ascii=False, indent=0) + ';\n')
print('wrote quote/blog-chrome.js')
