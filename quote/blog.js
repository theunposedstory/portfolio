/* The Unposed Story — Blog tab: write, SEO-check, preview and publish posts.
 * Posts are rendered here into finished static pages (best for Google), then the Apps Script
 * commits them to the website's GitHub repo; Cloudflare redeploys in about a minute.
 * Needs app.js (window.TUSApp) and blog-chrome.js (window.TUS_CHROME, generated). */
(function () {
'use strict';
var A = window.TUSApp, C = window.TUS_CHROME;
if (!A || !C) return;
var $ = A.$, $$ = A.$$, esc = A.esc, toast = A.toast, busy = A.busy;
var BASE = C.base;                                   // https://portfolio.theunposedstory.workers.dev/
var CATS = ['Wedding Tips', 'Pre-Wedding', 'Real Weddings', 'Venues & Locations', 'Planning & Budget', 'Behind the Scenes'];
var LINKS = [['/wedding-photography/', 'Wedding photography'], ['/pre-wedding-shoot/', 'Pre-wedding shoot'],
  ['/cinematic-wedding-films/', 'Cinematic wedding films'], ['/haldi-bridal-photography/', 'Haldi & bridal photography'],
  ['/#packages', 'Packages & prices'], ['/#enquire', 'Enquiry form (check your date)'], ['/blog/', 'Blog home']];
var IDEAS = [
  ['Best pre-wedding shoot locations in Mumbai', 'pre-wedding shoot locations in Mumbai', 'Venues & Locations'],
  ['How much does a wedding photographer cost in Mumbai?', 'wedding photographer cost in Mumbai', 'Planning & Budget'],
  ['Candid vs traditional wedding photography: what’s the difference?', 'candid vs traditional wedding photography', 'Wedding Tips'],
  ['Haldi ceremony photography: a shot list for brides', 'haldi photography ideas', 'Wedding Tips'],
  ['Questions to ask your wedding photographer before booking', 'questions to ask wedding photographer', 'Planning & Budget'],
  ['Real wedding: [couple names] at [venue], Thane', '[venue] wedding photography', 'Real Weddings'],
  ['Maharashtrian wedding rituals every photographer should capture', 'Maharashtrian wedding photography', 'Wedding Tips'],
  ['Wedding day timeline: how to plan around golden hour', 'wedding day timeline', 'Planning & Budget']
];
var B = { posts: null, github: null, p: null, dirty: false, slugTouched: false, img: {}, open: '' };

/* ================= helpers ================= */
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}
function escA(s) { return esc(s); }
function plain(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
function wordCount(t) { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; }
function norm(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim(); }
function has(hay, kw) { kw = norm(kw); return !!kw && (' ' + norm(hay) + ' ').indexOf(' ' + kw + ' ') >= 0; }
function nowIso() { return new Date().toISOString(); }
function fmt(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function seoTitle(p) { return (p.seoTitle || '').trim() || ((p.title || '').trim() + ' | The Unposed Story'); }
function readMins(w) { return Math.max(1, Math.round(w / 200)); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function blank() { return { id: '', status: 'Draft', title: '', seoTitle: '', slug: '', desc: '', keyword: '', category: '', cover: null, answer: '', html: '', faqs: [], words: 0, score: 0 }; }
function isPublished(p) { return p && p.status === 'Published'; }
function src(path) { return B.img[path] || ('..' + path); }           // editor/preview: show just-uploaded photos before the site redeploys

/* ================= paste / editor clean-up =================
 * Keeps only simple, SEO-friendly HTML: p, h2, h3, strong, em, a, ul, ol, li, blockquote, figure, img, figcaption, br. */
var KEEP = { P: 'p', H2: 'h2', H3: 'h3', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', A: 'a', UL: 'ul', OL: 'ol', LI: 'li',
  BLOCKQUOTE: 'blockquote', FIGURE: 'figure', IMG: 'img', FIGCAPTION: 'figcaption', BR: 'br', H1: 'h2', H4: 'h3', H5: 'h3', H6: 'h3' };
var BLOCK = /^<(p|h2|h3|ul|ol|blockquote|figure)\b/;
var DROP = { SCRIPT: 1, STYLE: 1, META: 1, TITLE: 1, IFRAME: 1, OBJECT: 1, SVG: 1, NOSCRIPT: 1, TEMPLATE: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1 };
function cleanHtml(html) {
  var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  function kids(n) { return [].map.call(n.childNodes, ser).join(''); }
  function ser(n) {
    if (n.nodeType === 3) return esc(n.nodeValue.replace(/\u00a0/g, ' '));
    if (n.nodeType !== 1 || DROP[n.tagName]) return '';
    var t = n.tagName, st = n.getAttribute('style') || '', inner;
    if (t === 'SPAN' || (t === 'B' && /font-weight:\s*(normal|400)/.test(st))) {
      inner = kids(n);
      if (/font-weight:\s*(bold|[6-9]00)/.test(st)) inner = '<strong>' + inner + '</strong>';
      if (/font-style:\s*italic/.test(st)) inner = '<em>' + inner + '</em>';
      return inner;
    }
    if (t === 'DIV' || t === 'SECTION' || t === 'ARTICLE') {
      inner = kids(n);
      return n.querySelector('p,h1,h2,h3,h4,ul,ol,blockquote,figure,div') ? inner : (inner.trim() ? '<p>' + inner + '</p>' : '');
    }
    var tag = KEEP[t];
    if (!tag) return kids(n);
    if (tag === 'br') return '<br>';
    if (tag === 'img') {
      var s = n.getAttribute('data-src') || n.getAttribute('src') || '';
      if (!/^\/assets\/blog\/[a-z0-9-]+\.(webp|jpg)$/.test(s)) return '';
      var w = +n.getAttribute('width') || 0, h = +n.getAttribute('height') || 0;
      return '<img src="' + s + '" alt="' + escA(n.getAttribute('alt') || '') + '"' + (w && h ? ' width="' + w + '" height="' + h + '"' : '') + '>';
    }
    if (tag === 'p' && n.parentNode && /^(LI|BLOCKQUOTE)$/.test(n.parentNode.tagName)) return kids(n) + (n.nextElementSibling ? '<br>' : '');
    inner = kids(n);
    if (tag === 'a') {
      var href = (n.getAttribute('href') || '').trim();
      if (href.indexOf(BASE) === 0) href = '/' + href.slice(BASE.length);
      if (!/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href)) return inner;
      return inner.trim() ? '<a href="' + escA(href) + '">' + inner + '</a>' : '';
    }
    if (tag === 'figure') return /<img /.test(inner) ? '<figure>' + inner.replace(/<\/?p>/g, '') + '</figure>' : inner;
    if (/^(p|h2|h3|li|blockquote|figcaption|strong|em)$/.test(tag) && !inner.replace(/<br>/g, '').trim()) return '';
    if (/^(h2|h3)$/.test(tag)) inner = inner.replace(/<\/?(strong|em)>/g, '');
    return '<' + tag + '>' + inner + '</' + tag + '>';
  }
  var out = [], buf = '';
  [].forEach.call(doc.body.childNodes, function (n) {
    var s = ser(n);
    if (BLOCK.test(s)) { if (buf.replace(/<br>/g, '').trim()) out.push('<p>' + buf.replace(/^(<br>)+|(<br>)+$/g, '') + '</p>'); buf = ''; out.push(s); }
    else buf += s;
  });
  if (buf.replace(/<br>/g, '').trim()) out.push('<p>' + buf.replace(/^(<br>)+|(<br>)+$/g, '') + '</p>');
  return out.join('\n');
}

/* ================= rendering the public pages ================= */
function abs(path) { return BASE + String(path || '').replace(/^\//, ''); }
function smOf(path) { return String(path).replace(/\.(webp|jpg)$/, '-sm.$1'); }
function ldJson(o) { return '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>'; }
function chrome(s, R) { return s.split('{{R}}').join(R); }
function coverOf(p) { return p.cover && p.cover.src ? p.cover : { src: '/assets/img/hero-couple-sunset.webp', w: 933, h: 1400, alt: 'Couple at sunset — The Unposed Story', fallback: true }; }

/* Post body: relative links, lazy responsive images, h2 ids for the table of contents. */
function prepareBody(html, R, imgMap) {
  var d = document.createElement('div'); d.innerHTML = html || '';
  var used = {}, toc = [];
  $$('h2', d).forEach(function (h) {
    var id = slugify(h.textContent) || 'section'; while (used[id]) id += '-2'; used[id] = 1;
    h.id = id; toc.push([id, h.textContent.trim()]);
  });
  $$('img', d).forEach(function (im) {
    var s = im.getAttribute('src'), w = +im.getAttribute('width') || 1600;
    if (imgMap && imgMap[s]) { im.setAttribute('src', imgMap[s]); }
    else {
      im.setAttribute('src', R + s.slice(1));
      im.setAttribute('srcset', R + smOf(s).slice(1) + ' ' + Math.min(800, w) + 'w, ' + R + s.slice(1) + ' ' + w + 'w');
      im.setAttribute('sizes', '(max-width:760px) 100vw, 720px');
    }
    im.setAttribute('loading', 'lazy'); im.setAttribute('decoding', 'async');
  });
  $$('a', d).forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (/^\/(?!\/)/.test(h)) a.setAttribute('href', R + h.slice(1));
    else if (/^https?:/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
  });
  return { html: d.innerHTML, toc: toc };
}

function head(o) {
  var R = o.R;
  return '<!doctype html>\n<html lang="en-IN">\n<head>\n<meta charset="utf-8">\n' +
    '<script>if(location.hostname===\'theunposedstory.github.io\'){location.replace(\'' + BASE.replace(/\/$/, '') + '\'+location.pathname.replace(/^\\/portfolio/,\'\')+location.search+location.hash)}</script>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<title>' + esc(o.title) + '</title>\n<meta name="description" content="' + escA(o.desc) + '">\n' +
    '<link rel="canonical" href="' + o.url + '">\n<meta name="robots" content="' + (o.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1') + '">\n' +
    '<meta name="theme-color" content="#3D4724">\n<meta name="author" content="Sandip Lade">\n' +
    '<meta property="og:type" content="' + (o.article ? 'article' : 'website') + '"><meta property="og:site_name" content="The Unposed Story"><meta property="og:locale" content="en_IN">\n' +
    '<meta property="og:title" content="' + escA(o.ogTitle || o.title) + '"><meta property="og:description" content="' + escA(o.desc) + '">\n' +
    '<meta property="og:url" content="' + o.url + '"><meta property="og:image" content="' + o.image + '">' + (o.imageAlt ? '<meta property="og:image:alt" content="' + escA(o.imageAlt) + '">' : '') + '\n' +
    (o.article ? '<meta property="article:published_time" content="' + o.article.published + '"><meta property="article:modified_time" content="' + o.article.modified + '">' +
      (o.article.section ? '<meta property="article:section" content="' + escA(o.article.section) + '">' : '') + '\n' : '') +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<link rel="alternate" type="application/rss+xml" title="The Unposed Story — Blog" href="' + BASE + 'blog/feed.xml">\n' +
    '<link rel="icon" href="' + R + 'assets/img/favicon-48.png" sizes="48x48" type="image/png"><link rel="apple-touch-icon" href="' + R + 'assets/img/apple-touch-icon.png">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="preload" as="style" href="' + C.fonts + '" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="' + C.fonts + '"></noscript>\n' +
    (o.preload || '') +
    '<link rel="stylesheet" href="' + R + C.css + '">\n<script>document.documentElement.classList.add(\'js\')</script>\n' +
    o.schema + '\n</head>\n<body>\n<a class="skip" href="#main">Skip to content</a>\n' +
    chrome(C.header, R).replace('href="' + R + 'blog/"', 'href="' + R + 'blog/" aria-current="page"') + '\n\n';
}
function foot(R) {
  return '\n' + chrome(C.footer, R) + '\n\n' + chrome(C.fab, R) + '\n' + chrome(C.mbar, R) +
    '\n<script>document.getElementById(\'yr\').textContent=new Date().getFullYear();</script>\n<script src="' + R + C.js + '" defer></script>\n</body>\n</html>\n';
}
function ctaBlock(R, topic) {
  var wa = 'https://wa.me/917045278377?text=' + encodeURIComponent('Hello Sandip, I read your blog' + (topic ? ' post “' + topic + '”' : '') + ' and would like to check availability for our wedding.');
  return '<section class="sec cta" id="enquire" aria-labelledby="cta-h">\n  <div class="wrap cta-grid">\n    <div>\n      <span class="eyebrow">Reserve your date</span>\n' +
    '      <h2 class="h2" id="cta-h">Let’s begin <em>your story.</em></h2>\n      <p class="lead" style="margin-top:18px">Share your date and city. We’ll confirm availability within 24 hours and send a detailed quotation.</p>\n    </div>\n' +
    '    <div class="contact-list">\n      <a href="' + escA(wa) + '" target="_blank" rel="noopener"><span><small>WhatsApp · fastest reply</small><b>+91 70452 78377</b></span></a>\n' +
    '      <a href="tel:+917045278377"><span><small>Call Sandip</small><b>+91 70452 78377</b></span></a>\n' +
    '      <a href="' + R + '#enquire"><span><small>Prefer a form?</small><b>Send an enquiry →</b></span></a>\n    </div>\n  </div>\n</section>';
}
function card(m, R, big) {
  var c = coverOf(m), s = c.src;
  return '<article class="bcard' + (big ? ' bcard-lg' : '') + '" data-cat="' + escA(slugify(m.category)) + '">' +
    '<a class="bcard-ph" href="' + R + 'blog/' + m.slug + '/" tabindex="-1" aria-hidden="true"><img src="' + R + (c.fallback ? s.slice(1) : smOf(s).slice(1)) + '" width="' + (c.w || 800) + '" height="' + (c.h || 533) + '" alt="" loading="lazy" decoding="async"></a>' +
    '<div class="bcard-tx">' + (m.category ? '<span class="bcard-cat">' + esc(m.category) + '</span>' : '') +
    '<h' + (big ? 2 : 3) + '><a href="' + R + 'blog/' + m.slug + '/">' + esc(m.title) + '</a></h' + (big ? 2 : 3) + '>' +
    (big ? '<p>' + esc(m.desc) + '</p>' : '') +
    '<small><time datetime="' + (m.published || '').slice(0, 10) + '">' + fmt(m.published) + '</time> · ' + readMins(m.words || 0) + ' min read</small></div></article>';
}

function renderPost(p, list, R, imgMap) {
  var url = BASE + 'blog/' + p.slug + '/', c = coverOf(p);
  var body = prepareBody(p.html, R, imgMap);
  var words = p.words || wordCount(plain(p.html));
  var faqs = (p.faqs || []).filter(function (f) { return f.q && f.a; });
  var related = list.filter(function (m) { return m.id !== p.id && m.status === 'Published'; })
    .sort(function (a, b) { return (b.category === p.category) - (a.category === p.category) || String(b.published).localeCompare(String(a.published)); }).slice(0, 3);
  var coverUrl = imgMap && imgMap[c.src] ? imgMap[c.src] : R + c.src.slice(1);
  var graph = [{
    '@type': 'BlogPosting', '@id': url + '#article', headline: p.title.slice(0, 110), description: p.desc, url: url, mainEntityOfPage: url,
    image: [abs(c.src)], datePublished: p.published, dateModified: p.modified || p.published, inLanguage: 'en-IN',
    articleSection: p.category || undefined, keywords: p.keyword || undefined, wordCount: words,
    author: { '@type': 'Person', '@id': BASE + '#sandip', name: 'Sandip Lade', url: BASE + '#about', jobTitle: 'Founder & Lead Wedding Photographer' },
    publisher: { '@type': 'Organization', '@id': BASE + '#business', name: 'The Unposed Story', url: BASE, logo: { '@type': 'ImageObject', url: BASE + 'assets/img/logo.png' } },
    isPartOf: { '@type': 'Blog', '@id': BASE + 'blog/#blog', name: 'The Unposed Story — Wedding Photography Blog' }
  }, { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE + 'blog/' },
    { '@type': 'ListItem', position: 3, name: p.title, item: url }] }];
  if (faqs.length) graph.push({ '@type': 'FAQPage', mainEntity: faqs.map(function (f) { return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; }) });
  var h = head({ R: R, title: seoTitle(p), ogTitle: p.title, desc: p.desc, url: url, image: abs(c.src), imageAlt: c.alt || p.coverAlt,
    article: { published: p.published, modified: p.modified || p.published, section: p.category },
    preload: c.fallback || (imgMap && imgMap[c.src]) ? '' : '<link rel="preload" as="image" href="' + R + c.src.slice(1) + '" imagesrcset="' + R + smOf(c.src).slice(1) + ' 800w, ' + R + c.src.slice(1) + ' ' + (c.w || 1600) + 'w" imagesizes="(max-width:900px) 100vw, 900px" fetchpriority="high">\n',
    schema: ldJson({ '@context': 'https://schema.org', '@graph': graph }) });
  var m = '<main id="main">\n<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="' + R + '">Home</a> <span>/</span> <a href="' + R + 'blog/">Blog</a> <span>/</span> <span aria-current="page">' + esc(p.title) + '</span></nav>\n' +
    '<article class="post">\n<header class="post-hd wrap">\n' +
    (p.category ? '<a class="eyebrow" href="' + R + 'blog/#' + slugify(p.category) + '">' + esc(p.category) + '</a>\n' : '') +
    '<h1 class="post-title">' + esc(p.title) + '</h1>\n' + (p.desc ? '<p class="post-dek">' + esc(p.desc) + '</p>\n' : '') +
    '<div class="byline"><img src="' + R + 'assets/img/sandip-avatar.webp" width="48" height="48" alt="Sandip Lade"><div><b>By <a href="' + R + '#about" rel="author">Sandip Lade</a></b>' +
    '<span><time datetime="' + String(p.published).slice(0, 10) + '">' + fmt(p.published) + '</time>' +
    (p.modified && String(p.modified).slice(0, 10) !== String(p.published).slice(0, 10) ? ' · Updated <time datetime="' + String(p.modified).slice(0, 10) + '">' + fmt(p.modified) + '</time>' : '') +
    ' · ' + readMins(words) + ' min read</span></div></div>\n</header>\n' +
    '<figure class="post-cover wrap"><img src="' + coverUrl + '"' + (c.fallback || (imgMap && imgMap[c.src]) ? '' : ' srcset="' + R + smOf(c.src).slice(1) + ' 800w, ' + R + c.src.slice(1) + ' ' + (c.w || 1600) + 'w" sizes="(max-width:900px) 100vw, 900px"') +
    ' width="' + (c.w || 1600) + '" height="' + (c.h || 1067) + '" alt="' + escA(c.alt || p.title) + '" fetchpriority="high"></figure>\n' +
    '<div class="post-body">\n' +
    (p.answer ? '<aside class="post-answer" aria-label="Quick answer"><b>In short</b><p>' + esc(p.answer) + '</p></aside>\n' : '') +
    (body.toc.length >= 3 ? '<nav class="post-toc" aria-label="In this article"><b>In this article</b><ol>' + body.toc.map(function (t) { return '<li><a href="#' + t[0] + '">' + esc(t[1]) + '</a></li>'; }).join('') + '</ol></nav>\n' : '') +
    '<div class="prose">\n' + body.html + '\n</div>\n' +
    (faqs.length ? '<section class="post-faq faq" aria-labelledby="faq-h"><h2 id="faq-h">Frequently asked questions</h2>' +
      faqs.map(function (f, i) { return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'; }).join('') + '</section>\n' : '') +
    '<aside class="author-box"><img src="' + R + 'assets/img/sandip-avatar.webp" width="96" height="96" alt="" loading="lazy"><div><span class="eyebrow">About the author</span>' +
    '<p><b>Sandip Lade</b> is the founder and lead photographer of The Unposed Story, a candid wedding photography and cinematic films studio in Mumbai. ' +
    'He has photographed 50+ weddings across Mumbai, Thane, Navi Mumbai, Pune and destination venues.</p>' +
    '<p class="author-links"><a href="' + R + 'wedding-photography/">Wedding photography</a> · <a href="' + R + '#packages">Packages</a> · <a href="https://instagram.com/theunposedstory" target="_blank" rel="noopener">Instagram</a></p></div></aside>\n' +
    '</div>\n</article>\n' +
    (related.length ? '<section class="sec blog-more" aria-labelledby="more-h">\n  <div class="wrap">\n    <div class="sec-head"><div><span class="eyebrow">Keep reading</span><h2 class="h2" id="more-h">More from <em>the blog</em></h2></div><a class="link" href="' + R + 'blog/">All posts →</a></div>\n' +
      '    <div class="bgrid">' + related.map(function (r) { return card(r, R); }).join('') + '</div>\n  </div>\n</section>\n' : '') +
    ctaBlock(R, p.title) + '\n</main>\n';
  return h + m + foot(R);
}

function published(list) { return list.filter(isPublished).sort(function (a, b) { return String(b.published).localeCompare(String(a.published)); }); }
function renderIndex(list) {
  var R = '../', posts = published(list), url = BASE + 'blog/';
  var cats = []; posts.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
  var graph = [{ '@type': 'Blog', '@id': url + '#blog', name: 'The Unposed Story — Wedding Photography Blog', url: url, inLanguage: 'en-IN',
      description: 'Wedding photography tips, pre-wedding shoot ideas, venues and real weddings from Mumbai by Sandip Lade.',
      publisher: { '@id': BASE + '#business' },
      blogPost: posts.slice(0, 30).map(function (p) { return { '@type': 'BlogPosting', headline: p.title, url: url + p.slug + '/', datePublished: p.published, image: abs(coverOf(p).src) }; }) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: BASE }, { '@type': 'ListItem', position: 2, name: 'Blog', item: url }] }];
  var h = head({ R: R, title: 'Wedding Photography Blog: Tips, Ideas & Real Weddings | The Unposed Story',
    desc: 'Wedding photography tips, pre-wedding shoot ideas, Mumbai venues and real wedding stories from Sandip Lade of The Unposed Story.',
    url: url, image: posts[0] ? abs(coverOf(posts[0]).src) : BASE + 'assets/img/hero-couple-sunset.webp', noindex: !posts.length,
    schema: ldJson({ '@context': 'https://schema.org', '@graph': graph }) });
  var m = '<main id="main">\n<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="' + R + '">Home</a> <span>/</span> <span aria-current="page">Blog</span></nav>\n' +
    '<section class="blog-hero">\n  <div class="wrap">\n    <h1><span class="eyebrow">The Unposed Story Journal</span><span class="display">Wedding photography <em>blog</em></span></h1>\n' +
    '    <p class="lead">Tips, pre-wedding shoot ideas, Mumbai venues and real wedding stories, written by Sandip Lade from 50+ weddings behind the camera.</p>\n' +
    (cats.length > 1 ? '    <div class="bchips" role="group" aria-label="Filter by topic"><button type="button" class="bchip on" data-c="">All</button>' + cats.map(function (c) { return '<button type="button" class="bchip" id="' + slugify(c) + '" data-c="' + slugify(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>\n' : '') +
    '  </div>\n</section>\n<section class="sec blog-list" aria-label="All posts" style="padding-top:0">\n  <div class="wrap">\n' +
    (posts.length ? '    <div class="bgrid">' + posts.map(function (p, i) { return card(p, R, i === 0); }).join('\n') + '</div>\n'
      : '    <div class="blog-empty"><h2>First stories coming soon</h2><p>We’re writing guides on pre-wedding locations, wedding budgets and real weddings from Mumbai. Meanwhile, see our <a href="' + R + '#work">portfolio</a>.</p></div>\n') +
    '  </div>\n</section>\n' + ctaBlock(R, '') + '\n</main>\n' +
    (cats.length > 1 ? '<script>(function(){var b=document.querySelectorAll(".bchip"),c=document.querySelectorAll(".bcard");function go(k){b.forEach(function(x){x.classList.toggle("on",x.dataset.c===k)});c.forEach(function(x){x.hidden=!!k&&x.dataset.cat!==k})}b.forEach(function(x){x.onclick=function(){go(x.dataset.c);history.replaceState(null,"",x.dataset.c?"#"+x.dataset.c:location.pathname)}});var h=location.hash.slice(1);if(h&&document.querySelector(".bchip[data-c=\\""+h.replace(/[^a-z0-9-]/g,"")+"\\"]"))go(h)})();</script>\n' : '');
  return h + m + foot(R);
}
function xml(s) { return String(s == null ? '' : s).replace(/[<>&'"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]; }); }
function renderSitemap(list) {
  var posts = published(list), last = posts.reduce(function (a, p) { var d = p.modified || p.published; return d > a ? d : a; }, '');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    (posts.length ? '  <url><loc>' + BASE + 'blog/</loc><lastmod>' + last.slice(0, 10) + '</lastmod></url>\n' : '') +
    posts.map(function (p) {
      var c = coverOf(p);
      return '  <url><loc>' + BASE + 'blog/' + p.slug + '/</loc><lastmod>' + String(p.modified || p.published).slice(0, 10) + '</lastmod>' +
        (c.fallback ? '' : '<image:image><image:loc>' + xml(abs(c.src)) + '</image:loc></image:image>') + '</url>';
    }).join('\n') + (posts.length ? '\n' : '') + '</urlset>\n';
}
function renderFeed(list) {
  var posts = published(list).slice(0, 20);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
    '<title>The Unposed Story — Wedding Photography Blog</title>\n<link>' + BASE + 'blog/</link>\n' +
    '<atom:link href="' + BASE + 'blog/feed.xml" rel="self" type="application/rss+xml"/>\n' +
    '<description>Wedding photography tips, pre-wedding ideas and real weddings from Mumbai by Sandip Lade.</description>\n<language>en-in</language>\n' +
    posts.map(function (p) {
      return '<item><title>' + xml(p.title) + '</title><link>' + BASE + 'blog/' + p.slug + '/</link><guid>' + BASE + 'blog/' + p.slug + '/</guid>' +
        '<pubDate>' + new Date(p.published).toUTCString() + '</pubDate>' + (p.category ? '<category>' + xml(p.category) + '</category>' : '') +
        '<description>' + xml(p.desc) + '</description></item>';
    }).join('\n') + (posts.length ? '\n' : '') + '</channel>\n</rss>\n';
}
function renderRedirect(p) {
  var to = BASE + 'blog/' + p.slug + '/';
  return '<!doctype html>\n<html lang="en-IN"><head><meta charset="utf-8"><title>' + esc(p.title) + '</title><link rel="canonical" href="' + to + '">' +
    '<meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0; url=' + to + '"></head>' +
    '<body><p>This post has moved: <a href="' + to + '">' + esc(p.title) + '</a></p><script>location.replace("' + to + '")</script></body></html>\n';
}
function indexFiles(list) {
  return [{ path: 'blog/index.html', content: renderIndex(list) }, { path: 'blog/sitemap.xml', content: renderSitemap(list) }, { path: 'blog/feed.xml', content: renderFeed(list) }];
}

/* ================= SEO checklist ================= */
function analyse(p) {
  var kw = (p.keyword || '').trim(), title = seoTitle(p), text = plain(p.html), words = wordCount(text);
  var d = document.createElement('div'); d.innerHTML = p.html || '';
  var h2 = $$('h2', d).map(function (h) { return h.textContent; });
  var firstP = ($$('p', d)[0] || {}).textContent || '';
  var imgs = $$('img', d), links = $$('a', d).map(function (a) { return a.getAttribute('href') || ''; });
  var internal = links.filter(function (h) { return /^\/(?!\/)/.test(h); });
  var longP = $$('p', d).filter(function (x) { return wordCount(x.textContent) > 120; }).length;
  var kwHits = kw ? (' ' + norm(text) + ' ').split(' ' + norm(kw) + ' ').length - 1 : 0;
  var density = words ? kwHits * wordCount(kw) / words * 100 : 0;
  var ansW = wordCount(p.answer), faqs = (p.faqs || []).filter(function (f) { return f.q && f.a; }).length;
  var c = [];
  function add(state, label, tip, wt) { c.push({ s: state, t: label, tip: tip, w: wt || 1 }); }
  add(kw ? 2 : 0, kw ? 'Focus keyword: “' + kw + '”' : 'Add a focus keyword', 'The phrase couples type into Google, e.g. “pre-wedding shoot locations in Mumbai”.', 2);
  if (kw) {
    add(has(title, kw) ? 2 : 0, 'Keyword in SEO title', 'Put the keyword near the start of the SEO title.', 2);
    add(has(p.title, kw) ? 2 : 1, 'Keyword in post title (H1)', 'Use the keyword, or close to it, in the main title.', 1);
    add(has(p.slug.replace(/-/g, ' '), kw) ? 2 : 1, 'Keyword in web address', 'Short slug with the keyword, e.g. /blog/pre-wedding-locations-mumbai/.', 1);
    add(has(p.desc, kw) ? 2 : 1, 'Keyword in meta description', 'Google bolds matching words in results.', 1);
    add(has(firstP, kw) ? 2 : 1, 'Keyword in the first paragraph', 'Say what the post is about in the first 2–3 sentences.', 1);
    add(h2.some(function (h) { return has(h, kw); }) ? 2 : 1, 'Keyword in a subheading (H2)', 'Use it (or a variation) in at least one H2.', 1);
    add(density >= 0.4 && density <= 2.5 ? 2 : 1, 'Keyword used naturally (' + density.toFixed(1) + '%)', density > 2.5 ? 'Too often: write naturally, use variations.' : 'Use the keyword a few more times, naturally.', 1);
  }
  add(title.length >= 30 && title.length <= 60 ? 2 : title.length <= 70 ? 1 : 0, 'SEO title length (' + title.length + '/60)', 'Aim for 30–60 characters so Google doesn’t cut it off.', 1);
  add(p.desc.length >= 120 && p.desc.length <= 160 ? 2 : p.desc.length >= 70 && p.desc.length <= 175 ? 1 : 0, 'Meta description (' + p.desc.length + '/160)', 'Aim for 120–160 characters: a clear promise + a reason to click.', 1);
  add(words >= 800 ? 2 : words >= 500 ? 1 : 0, 'Length: ' + words + ' words', 'Guides that rank usually have 800–1,500 words. Real detail beats filler.', 2);
  add(h2.length >= 2 ? 2 : h2.length ? 1 : 0, 'Subheadings: ' + h2.length + ' × H2', 'Break the post into sections with H2 headings (they also form the table of contents).', 1);
  add(p.cover && p.cover.src ? (p.cover.alt ? 2 : 1) : 0, 'Cover photo with description', 'Add a cover photo and describe it (alt text). It shows on Google, WhatsApp and social.', 1);
  add(!imgs.length ? 1 : imgs.every(function (i) { return (i.getAttribute('alt') || '').trim(); }) ? 2 : 0, imgs.length ? 'All photos described (alt text)' : 'Add photos inside the post', imgs.length ? 'Describe every photo: who, what, where.' : 'Your own wedding photos keep people reading and rank in Google Images.', 1);
  add(internal.length ? 2 : 0, 'Link to your service pages', 'Link to e.g. Wedding photography or Packages: helps Google and brings enquiries.', 1);
  add(ansW >= 25 && ansW <= 70 ? 2 : 1, 'Quick answer (' + ansW + ' words)', '2–3 sentences answering the title directly. Google & AI assistants quote this.', 1);
  add(faqs >= 2 ? 2 : 1, 'FAQs: ' + faqs, 'Add 2–5 real questions couples ask. Helps Google, ChatGPT and voice search.', 1);
  add(p.category ? 2 : 1, 'Category chosen', 'Groups related posts on the blog page.', 0.5);
  if (longP) add(1, longP + ' long paragraph' + (longP > 1 ? 's' : ''), 'Keep paragraphs under ~100 words for phone readers.', 0.5);
  var tot = c.reduce(function (s, x) { return s + x.w; }, 0), got = c.reduce(function (s, x) { return s + x.w * x.s / 2; }, 0);
  return { checks: c, score: Math.round(got / tot * 100), words: words };
}

/* ================= list screen ================= */
function open(h) {
  B.open = h;
  if (h === 'blog' || h === 'blog/') return showHome();
  var id = decodeURIComponent(h.slice(5));
  if (B.dirty && B.p && (B.p.id || 'new') !== id && !confirm('You have unsaved changes in this post. Leave without saving?')) { history.replaceState(null, '', '#blog/' + (B.p.id || 'new')); return; }
  if (id === 'new') return edit(blank(), true);
  var t = setTimeout(function () { busy(true, 'Opening post…'); }, 150);
  A.api('blogGet', { id: id }).then(function (r) {
    clearTimeout(t); busy(false);
    if (!r.ok) { toast(r.error || 'Could not open'); location.hash = 'blog'; return; }
    edit(r.post);
  }).catch(function (e) { clearTimeout(t); busy(false); if (e.message !== 'expired') toast('Could not reach Google. Try again.'); });
}
function showHome() {
  if (B.dirty && !confirm('You have unsaved changes in this post. Leave without saving?')) { history.replaceState(null, '', '#blog/' + (B.p.id || 'new')); return; }
  B.dirty = false; $('#blogHome').hidden = false; $('#blogEd').hidden = true; window.scrollTo(0, 0);
  renderList();
  A.api('blogList').then(function (r) {
    if (!r.ok) { if (r.error === 'Unknown action') return oldScript(); return toast(r.error || 'Could not load posts'); }
    B.posts = r.posts || []; B.github = r.github || {}; renderList();
  }).catch(function () {});
}
function renderList() {
  var gh = $('#ghCard');
  gh.hidden = !(B.github && !B.github.connected);
  if (!B.posts) { $('#postList').innerHTML = '<p class="muted">Loading posts…</p>'; return; }
  var pub = B.posts.filter(isPublished).length;
  $('#blogCount').textContent = B.posts.length ? pub + ' published · ' + (B.posts.length - pub) + ' draft' + (B.posts.length - pub === 1 ? '' : 's') : '';
  $('#postList').innerHTML = B.posts.length ? B.posts.map(function (p) {
    var sc = p.score || 0, cls = sc >= 80 ? 'good' : sc >= 50 ? 'ok' : 'bad';
    return '<div class="prow"><div class="prow-main"><b>' + esc(p.title || 'Untitled') + '</b><span class="muted">' +
      esc(p.category || 'No category') + ' · ' + (p.words || 0) + ' words · edited ' + fmt(p.updated) + '</span></div>' +
      '<span class="pill ' + (isPublished(p) ? 'pill-pub' : 'pill-draft') + '">' + (isPublished(p) ? (p.pending ? 'Live · edits not published' : 'Live') : 'Draft') + '</span>' +
      '<span class="seo-badge ' + cls + '" title="SEO score">' + sc + '</span>' +
      '<div class="prow-act">' + (isPublished(p) ? '<a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="../blog/' + esc(p.liveSlug || p.slug) + '/">View</a>' : '') +
      '<a class="btn btn-dark btn-sm" href="#blog/' + encodeURIComponent(p.id) + '">Edit</a></div></div>';
  }).join('') : '<div class="empty"><p><b>No posts yet.</b> Pick an idea below or start your own. Each post is a new way for couples to find you on Google.</p></div>';
  $('#ideaList').innerHTML = IDEAS.map(function (x, i) {
    return '<button type="button" class="idea" data-i="' + i + '"><b>' + esc(x[0]) + '</b><span>Keyword: ' + esc(x[1]) + '</span></button>';
  }).join('');
  $$('#ideaList [data-i]').forEach(function (b) {
    b.onclick = function () { var x = IDEAS[+b.dataset.i], p = blank(); p.title = x[0]; p.keyword = x[1]; p.category = x[2]; B.seed = p; location.hash = 'blog/new'; };
  });
}

/* ================= editor ================= */
function edit(p, isNew) {
  if (isNew && B.seed) { p = B.seed; B.seed = null; }
  B.p = p; B.dirty = !!isNew && !!p.title; B.slugTouched = !!p.slug; B.lastSaved = JSON.stringify(p);
  $('#blogHome').hidden = true; $('#blogEd').hidden = false; window.scrollTo(0, 0);
  $('#bTitle').value = p.title || ''; $('#bSeoTitle').value = p.seoTitle || ''; $('#bSlug').value = p.slug || slugify(p.title);
  $('#bDesc').value = p.desc || ''; $('#bKeyword').value = p.keyword || ''; $('#bCat').value = p.category || '';
  $('#bAnswer').value = p.answer || '';
  $('#bBody').innerHTML = editorHtml(p.html || '');
  $('#bCats').innerHTML = CATS.map(function (c) { return '<option value="' + escA(c) + '">'; }).join('');
  renderCover(); renderFaqs(); refresh();
  var local = localDraft(p.id || 'new');
  if (local && local.saved > (Date.parse(p.updated || 0) || 0) + 5000 && confirm('There’s a newer unsaved version of this post on this device (' + new Date(local.saved).toLocaleString('en-IN') + '). Restore it?')) {
    edit(Object.assign(clone(p), local.post)); B.dirty = true; refresh(); return;
  }
  if (isNew) $('#bTitle').focus();
}
function editorHtml(html) {   // show uploaded photos straight away, even before the site redeploys
  return String(html).replace(/<img src="(\/assets\/blog\/[^"]+)"/g, function (m, s) { return '<img src="' + src(s) + '" data-src="' + s + '"'; });
}
function collect() {
  var p = B.p;
  p.title = $('#bTitle').value.trim(); p.seoTitle = $('#bSeoTitle').value.trim();
  p.slug = slugify($('#bSlug').value || p.title); p.desc = $('#bDesc').value.replace(/\s+/g, ' ').trim();
  p.keyword = $('#bKeyword').value.trim(); p.category = $('#bCat').value.trim(); p.answer = $('#bAnswer').value.replace(/\s+/g, ' ').trim();
  p.html = cleanHtml($('#bBody').innerHTML);
  p.faqs = $$('#bFaqs .faq-row').map(function (r) { return { q: $('[data-f=q]', r).value.trim(), a: $('[data-f=a]', r).value.replace(/\s+/g, ' ').trim() }; }).filter(function (f) { return f.q || f.a; });
  var an = analyse(p); p.words = an.words; p.score = an.score;
  return p;
}
function refresh() {
  var p = collect(), an = analyse(p), t = seoTitle(p);
  $('#bHead').textContent = p.title || 'New post';
  $('#bStatusLine').textContent = isPublished(p) ? 'Published · ' + fmt(p.published) + (p.pending || B.dirty ? ' · changes not live yet' : '') : (p.id ? 'Draft · not on the website yet' : 'New post');
  $('#cTitle').textContent = t.length + '/60'; $('#cTitle').className = 'cnt ' + (t.length <= 60 && t.length >= 30 ? 'good' : 'bad');
  $('#cDesc').textContent = p.desc.length + '/160'; $('#cDesc').className = 'cnt ' + (p.desc.length <= 160 && p.desc.length >= 120 ? 'good' : 'bad');
  $('#bSeoTitle').placeholder = (p.title || 'Post title') + ' | The Unposed Story';
  $('#bSerp').innerHTML = '<small>Google preview</small><span class="serp-url">portfolio.theunposedstory.workers.dev › blog › ' + esc(p.slug || 'your-post') + '</span>' +
    '<b class="serp-t">' + esc(t.length > 62 ? t.slice(0, 60) + '…' : t) + '</b><span class="serp-d">' + (p.published ? fmt(p.published) + ' — ' : '') + esc(p.desc ? (p.desc.length > 160 ? p.desc.slice(0, 158) + '…' : p.desc) : 'Write a meta description: it’s the text Google shows under your title.') + '</span>';
  var sc = an.score; $('#bScore').textContent = sc; $('#bScoreBox').className = 'score ' + (sc >= 80 ? 'good' : sc >= 50 ? 'ok' : 'bad');
  $('#bScoreLbl').textContent = sc >= 80 ? 'Great: ready for Google' : sc >= 50 ? 'Good start: fix the red items' : 'Needs work';
  $('#bChecks').innerHTML = an.checks.map(function (x) { return '<li class="ck' + x.s + '"><b>' + esc(x.t) + '</b>' + (x.s < 2 ? '<span>' + esc(x.tip) + '</span>' : '') + '</li>'; }).join('');
  $('#bWords').textContent = an.words + ' words · ' + readMins(an.words) + ' min read';
  $('#bPublish').textContent = isPublished(p) ? 'Update live post' : 'Publish to website';
  $('#bUnpub').hidden = !isPublished(p); $('#bDelete').hidden = !p.id || isPublished(p);
  $('#bLive').innerHTML = isPublished(p) ? 'Live at <a href="../blog/' + esc(p.liveSlug || p.slug) + '/" target="_blank" rel="noopener">/blog/' + esc(p.liveSlug || p.slug) + '/</a>' : '';
  $('#bSlugWarn').hidden = !(p.liveSlug && p.slug !== p.liveSlug);
}
function changed() {
  B.dirty = true;
  if (!B.slugTouched) $('#bSlug').value = slugify($('#bTitle').value);
  clearTimeout(B.t); B.t = setTimeout(function () { refresh(); saveLocal(); }, 250);
}
function localDraft(id) { try { return JSON.parse(localStorage.getItem('tus_blog_' + id) || 'null'); } catch (e) { return null; } }
function saveLocal() { try { localStorage.setItem('tus_blog_' + (B.p.id || 'new'), JSON.stringify({ saved: Date.now(), post: B.p })); } catch (e) {} }
function dropLocal(id) { try { localStorage.removeItem('tus_blog_' + (id || 'new')); localStorage.removeItem('tus_blog_new'); } catch (e) {} }

/* cover photo */
function renderCover() {
  var c = B.p.cover;
  $('#bCoverBox').innerHTML = c && c.src ? '<img src="' + escA(src(c.src)) + '" alt=""><button type="button" class="btn btn-line btn-sm" id="bCoverChange">Change photo</button>'
    : '<b>Add a cover photo</b><span>Landscape works best (shows on Google, WhatsApp &amp; Instagram link previews)</span>';
  $('#bCoverAlt').value = c && c.alt || '';
}
/* Resize in the browser (1600px + 800px), upload both, return the website path. */
function resize(file, max) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var u = c.toDataURL('image/webp', 0.82), webp = u.indexOf('data:image/webp') === 0;   // WebP where the browser can make it (smaller, faster)
      if (!webp) u = c.toDataURL('image/jpeg', 0.84);
      res({ url: u, data: u.split(',')[1], mime: webp ? 'image/webp' : 'image/jpeg', ext: webp ? 'webp' : 'jpg', w: c.width, h: c.height });
    };
    im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This file type can’t be read. Use JPG or PNG.')); };
    im.src = url;
  });
}
function uploadPhoto(file, alt) {
  return resize(file, 1600).then(function (big) {
    return shrink(big, 800).then(function (sm) {
      var name = (slugify(alt || $('#bKeyword').value || $('#bTitle').value || 'wedding-photo').slice(0, 60).replace(/-+$/, '') || 'photo') + '-' + Math.random().toString(36).slice(2, 6);
      return A.api('blogUploadImage', { images: [{ name: name + '.' + big.ext, data: big.data }, { name: name + '-sm.' + big.ext, data: sm.data }] }).then(function (r) {
        if (!r.ok) throw new Error(r.error || 'Upload failed');
        var path = '/assets/blog/' + name + '.' + big.ext;
        B.img[path] = big.url;
        return { src: path, w: big.w, h: big.h };
      });
    });
  });
}
function shrink(big, max) {
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () {
      var sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      var u = c.toDataURL(big.mime, 0.8); res({ data: u.split(',')[1] });
    };
    im.src = big.url;
  });
}
function pickFile(cb) {
  var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = function () { if (i.files[0]) cb(i.files[0]); }; i.click();
}
function chooseCover() {
  pickFile(function (f) {
    var alt = $('#bCoverAlt').value.trim();
    busy(true, 'Uploading cover photo…');
    uploadPhoto(f, alt || $('#bKeyword').value).then(function (img) {
      busy(false); img.alt = alt; B.p.cover = img; renderCover(); changed();
      if (!alt) { toast('Now describe the photo (alt text)', 3500); $('#bCoverAlt').focus(); }
    }).catch(function (e) { busy(false); if (e.message !== 'expired') toast(e.message || 'Upload failed', 4000); });
  });
}

/* FAQ rows */
function renderFaqs() {
  var f = B.p.faqs && B.p.faqs.length ? B.p.faqs : [];
  $('#bFaqs').innerHTML = f.map(function (x, i) { return faqRow(x, i); }).join('') || '<p class="small muted" style="margin:0 0 10px">No questions yet.</p>';
  wireFaqs();
}
function faqRow(x) {
  return '<div class="faq-row"><input data-f="q" maxlength="180" placeholder="Question, e.g. How much does a pre-wedding shoot cost in Mumbai?" value="' + escA(x.q) + '">' +
    '<textarea data-f="a" rows="2" maxlength="900" placeholder="Answer in 2–4 sentences">' + esc(x.a) + '</textarea><button type="button" class="x" aria-label="Remove question">×</button></div>';
}
function wireFaqs() {
  $$('#bFaqs .faq-row').forEach(function (r) {
    $$('input,textarea', r).forEach(function (el) { el.oninput = changed; });
    $('.x', r).onclick = function () { r.remove(); changed(); };
  });
}

/* rich-text toolbar */
function cmd(c, v) { $('#bBody').focus(); document.execCommand(c, false, v); changed(); }
function block(tag) {
  var cur = (document.queryCommandValue('formatBlock') || '').toLowerCase();
  cmd('formatBlock', '<' + (cur === tag ? 'p' : tag) + '>');
}
function insertLink() {
  var sel = window.getSelection(), text = sel ? String(sel) : '';
  var range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  var menu = $('#linkPop');
  menu.innerHTML = '<b>Link ' + (text ? '“' + esc(text.slice(0, 40)) + '”' : 'selected text') + ' to…</b>' +
    LINKS.map(function (l) { return '<button type="button" data-h="' + l[0] + '">' + esc(l[1]) + '</button>'; }).join('') +
    '<label>Or paste a web address<input id="linkUrl" placeholder="https://"></label><div class="lp-act"><button type="button" class="btn btn-dark btn-sm" id="linkGo">Add link</button><button type="button" class="btn btn-line btn-sm" id="linkNo">Cancel</button></div>';
  menu.hidden = false;
  function done(h) {
    menu.hidden = true; if (!h) return;
    $('#bBody').focus(); if (range) { sel.removeAllRanges(); sel.addRange(range); }
    if (!text) { document.execCommand('insertHTML', false, '<a href="' + escA(h) + '">' + esc(h) + '</a>'); }
    else document.execCommand('createLink', false, h);
    changed();
  }
  $$('#linkPop [data-h]').forEach(function (b) { b.onclick = function () { done(b.dataset.h); }; });
  $('#linkGo').onclick = function () { var u = $('#linkUrl').value.trim(); if (u && !/^(https?:|\/|mailto:|tel:)/.test(u)) u = 'https://' + u; done(u); };
  $('#linkNo').onclick = function () { done(''); };
}
function insertPhoto() {
  var sel = window.getSelection(), range = sel && sel.rangeCount && $('#bBody').contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  pickFile(function (f) {
    var alt = prompt('Describe this photo for Google (who, what, where):', '');
    if (alt === null) return;
    busy(true, 'Uploading photo…');
    uploadPhoto(f, alt).then(function (img) {
      busy(false);
      $('#bBody').focus();
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
      document.execCommand('insertHTML', false, '<figure><img src="' + escA(src(img.src)) + '" data-src="' + img.src + '" alt="' + escA(alt) + '" width="' + img.w + '" height="' + img.h + '">' +
        '<figcaption>' + esc(alt) + '</figcaption></figure><p><br></p>');
      changed();
    }).catch(function (e) { busy(false); if (e.message !== 'expired') toast(e.message || 'Upload failed', 4000); });
  });
}

/* ================= save / preview / publish ================= */
function listWith(p) {
  return (B.posts || []).filter(function (x) { return x.id !== p.id; }).concat([meta(p)]);
}
function meta(p) { var m = clone(p); delete m.html; delete m.faqs; delete m.answer; return m; }
function save(quiet) {
  var p = collect();
  if (!p.title) { toast('Add a title first'); $('#bTitle').focus(); return Promise.reject(new Error('title')); }
  if (isPublished(p)) p.pending = true;
  if (!quiet) busy(true, 'Saving…');
  return A.api('blogSave', { post: p }).then(function (r) {
    busy(false);
    if (!r.ok) { toast(r.error || 'Could not save', 4000); throw new Error(r.error); }
    var wasNew = !p.id;
    dropLocal(p.id); Object.assign(B.p, r.post); B.dirty = false; upsert(r.post);
    if (wasNew) history.replaceState(null, '', '#blog/' + encodeURIComponent(r.post.id));
    refresh(); if (!quiet) toast('Draft saved');
    return B.p;
  }, function (e) { busy(false); if (e.message !== 'expired') toast('Could not reach Google. Your draft is kept on this device.', 4000); throw e; });
}
function upsert(m) {
  if (!B.posts) B.posts = [];
  var i = B.posts.map(function (x) { return x.id; }).indexOf(m.id);
  m = meta(m); if (i >= 0) B.posts[i] = m; else B.posts.unshift(m);
}
function preview() {
  var p = clone(collect());
  p.published = p.published || nowIso(); p.modified = nowIso(); p.status = 'Published';
  var map = {}; Object.keys(B.img).forEach(function (k) { map[k] = B.img[k]; });
  var html = renderPost(p, listWith(p), '../', Object.keys(map).length ? map : null)
    .replace(/<script>if\(location\.hostname[^<]*<\/script>/, '');
  $('#bFrame').srcdoc = html; $('#bPreview').hidden = false; document.body.style.overflow = 'hidden';
}
function problems(p) {
  var e = [];
  if (!p.title) e.push('a title');
  if (!p.desc) e.push('a meta description');
  if (wordCount(plain(p.html)) < 150) e.push('at least 150 words of content');
  if (p.cover && p.cover.src && !p.cover.alt) e.push('a description (alt text) for the cover photo');
  return e;
}
function publish() {
  var p = collect(), miss = problems(p);
  if (miss.length) { toast('Before publishing, add ' + miss.join(', ') + '.', 4500); return; }
  if (B.github && !B.github.connected && !A.DEMO) { toast('Connect your website first (one-time setup).', 4000); location.hash = 'blog'; return; }
  var an = analyse(p);
  if (an.score < 50 && !confirm('SEO score is ' + an.score + '/100. Publish anyway? (You can improve and update it later.)')) return;
  var post = clone(p); post.published = post.published || nowIso(); post.modified = nowIso(); post.status = 'Published'; post.pending = false;
  var list = listWith(post);
  var files = [{ path: 'blog/' + post.slug + '/index.html', content: renderPost(post, list, '../../') }].concat(indexFiles(list));
  if (post.liveSlug && post.liveSlug !== post.slug) files.push({ path: 'blog/' + post.liveSlug + '/index.html', content: renderRedirect(post) });
  busy(true, isPublished(p) ? 'Updating the live post…' : 'Publishing to your website…');
  A.api('blogPublish', { post: post, files: files }).then(function (r) {
    busy(false);
    if (!r.ok) { toast(r.error || 'Could not publish', 6000); return; }
    dropLocal(p.id); Object.assign(B.p, r.post); B.p.html = post.html; B.dirty = false; upsert(B.p);
    if (location.hash !== '#blog/' + r.post.id) history.replaceState(null, '', '#blog/' + encodeURIComponent(r.post.id));
    refresh(); done(r.url || BASE + 'blog/' + post.slug + '/');
  }).catch(function (e) { busy(false); if (e.message !== 'expired') toast('Could not reach Google. Nothing was published; try again.', 4500); });
}
function done(url) {
  $('#pubDone').hidden = false;
  $('#pubUrl').href = url; $('#pubUrl').textContent = url.replace(/^https:\/\//, '');
  $('#pubWa').href = 'https://wa.me/?text=' + encodeURIComponent(B.p.title + '\n' + url);
}
function unpublish() {
  if (!confirm('Take this post off the website? It stays here as a draft.')) return;
  var p = collect(), list = (B.posts || []).filter(function (x) { return x.id !== p.id; });
  busy(true, 'Removing from the website…');
  A.api('blogUnpublish', { id: p.id, files: indexFiles(list) }).then(function (r) {
    busy(false);
    if (!r.ok) { toast(r.error || 'Could not unpublish', 5000); return; }
    Object.assign(B.p, r.post); upsert(B.p); refresh(); toast('Removed from the website. Saved as a draft.');
  }).catch(function (e) { busy(false); if (e.message !== 'expired') toast('Could not reach Google.'); });
}
function del() {
  if (!B.p.id) { B.dirty = false; dropLocal(''); location.hash = 'blog'; return; }
  if (!confirm('Delete this draft permanently?')) return;
  A.api('blogDelete', { id: B.p.id }).then(function (r) {
    if (!r.ok) return toast(r.error || 'Could not delete');
    B.posts = (B.posts || []).filter(function (x) { return x.id !== B.p.id; }); dropLocal(B.p.id); B.dirty = false; location.hash = 'blog'; toast('Draft deleted');
  });
}
/* After a design change to the site: re-render every live post with the current header/footer. */
function rebuildAll() {
  var live = (B.posts || []).filter(isPublished);
  if (!live.length) return toast('No published posts yet');
  if (!confirm('Re-create all ' + live.length + ' live post' + (live.length > 1 ? 's' : '') + ' with the current website design?')) return;
  busy(true, 'Rebuilding ' + live.length + ' posts…');
  Promise.all(live.map(function (m) { return A.api('blogGet', { id: m.id }); })).then(function (rs) {
    var files = [];
    rs.forEach(function (r) { if (r.ok) files.push({ path: 'blog/' + r.post.slug + '/index.html', content: renderPost(r.post, B.posts, '../../') }); });
    files = files.concat(indexFiles(B.posts));
    return A.api('blogCommit', { files: files, message: 'Blog: rebuild ' + live.length + ' posts with the current design' });
  }).then(function (r) { busy(false); toast(r.ok ? 'All posts rebuilt. Live in about a minute.' : (r.error || 'Rebuild failed'), 4500); })
    .catch(function (e) { busy(false); if (e.message !== 'expired') toast('Rebuild failed: ' + e.message, 4500); });
}
function connect(e) {
  e.preventDefault();
  var tok = $('#ghToken').value.trim(); if (!tok) return;
  var btn = $('#ghSave'); btn.disabled = true;
  A.api('blogSetToken', { githubToken: tok }).then(function (r) {
    btn.disabled = false; $('#ghToken').value = '';
    if (!r.ok) { if (r.error === 'Unknown action') return oldScript(); $('#ghMsg').textContent = r.error; return; }
    B.github = { connected: true }; $('#ghMsg').textContent = ''; renderList(); toast('Website connected. You can publish posts now.', 4000);
  }).catch(function () { btn.disabled = false; $('#ghMsg').textContent = 'Could not reach Google. Did you deploy the new Code.gs version?'; });
}
function oldScript() {
  $('#postList').innerHTML = '<div class="empty"><p><b>One step left:</b> Your Google script is still the old version. In Apps Script: paste the new Code.gs, Save, run setupBlog once, then Deploy → Manage deployments → ✏️ → Version: New version → Deploy.</p></div>';
  $('#ghCard').hidden = false; $('#ghMsg').textContent = 'Your Google script is still the old version. In Apps Script: paste the new Code.gs, Save, run setupBlog once, then Deploy → Manage deployments → ✏️ → Version: New version → Deploy.';
}
function checkConnection() {
  busy(true, 'Checking the website connection…');
  A.api('blogStatus').then(function (r) {
    busy(false); if (!r.ok && r.error === 'Unknown action') return oldScript(); B.github = { connected: !!r.connected }; renderList();
    if (r.connected) toast('Connected to GitHub (' + r.repo + '). Publishing works.', 4000);
    else { $('#ghCard').hidden = false; $('#ghMsg').textContent = r.error || 'Not connected yet.'; $('#ghCard').scrollIntoView({ behavior: 'smooth' }); }
  }).catch(function () { busy(false); });
}

/* ================= wiring ================= */
function wire() {
  ['#bTitle', '#bSeoTitle', '#bDesc', '#bKeyword', '#bCat', '#bAnswer', '#bCoverAlt'].forEach(function (s) { $(s).addEventListener('input', changed); });
  $('#bCoverAlt').addEventListener('input', function () { if (B.p.cover) B.p.cover.alt = $('#bCoverAlt').value.trim(); });
  $('#bSlug').addEventListener('input', function () { B.slugTouched = true; changed(); });
  $('#bSlug').addEventListener('blur', function () { $('#bSlug').value = slugify($('#bSlug').value || $('#bTitle').value); changed(); });
  $('#bBody').addEventListener('input', changed);
  $('#bBody').addEventListener('paste', function (e) {
    var cd = e.clipboardData; if (!cd) return;
    e.preventDefault();
    var h = cd.getData('text/html'), t = cd.getData('text/plain');
    var html = h ? cleanHtml(h) : t.split(/\n{2,}/).map(function (para) { return para.trim() ? '<p>' + esc(para.trim()).replace(/\n/g, '<br>') + '</p>' : ''; }).join('');
    document.execCommand('insertHTML', false, html); changed();
  });
  $('#bBody').addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) e.preventDefault(); });
  $('#bCoverBox').addEventListener('click', chooseCover);
  $('#bAddFaq').onclick = function () {
    if ($('#bFaqs p')) $('#bFaqs').innerHTML = '';
    $('#bFaqs').insertAdjacentHTML('beforeend', faqRow({ q: '', a: '' })); wireFaqs(); $$('#bFaqs [data-f=q]').pop().focus();
  };
  $$('#rteBar [data-c]').forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.onclick = function () {
      var c = b.dataset.c;
      if (c === 'h2' || c === 'h3' || c === 'blockquote') block(c);
      else if (c === 'p') cmd('formatBlock', '<p>');
      else if (c === 'link') insertLink();
      else if (c === 'unlink') cmd('unlink');
      else if (c === 'photo') insertPhoto();
      else if (c === 'clear') { cmd('removeFormat'); cmd('formatBlock', '<p>'); }
      else cmd(c);
    };
  });
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  $('#bSave').onclick = function () { save().catch(function () {}); };
  $('#bPreviewBtn').onclick = preview;
  $('#bPublish').onclick = publish;
  $('#bUnpub').onclick = unpublish;
  $('#bDelete').onclick = del;
  $('#pubClose').onclick = function () { $('#pubDone').hidden = true; };
  $$('#bPreview [data-w]').forEach(function (b) { b.onclick = function () { $('#bFrame').style.maxWidth = b.dataset.w + 'px'; $$('#bPreview [data-w]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  $('#bPreview .x').onclick = function () { $('#bPreview').hidden = true; document.body.style.overflow = ''; };
  $('#ghForm').addEventListener('submit', connect);
  $('#ghCheck').onclick = checkConnection;
  $('#rebuildAll').onclick = rebuildAll;
  window.addEventListener('beforeunload', function (e) { if (B.dirty && !$('#blogEd').hidden) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('#blogEd').hidden && !$('#blog').hidden) { e.preventDefault(); save().catch(function () {}); }
  });
}

/* ================= demo backend (?demo=1) ================= */
var demoPosts = {}, demoGh = true;
function demo(a, d) {
  function m(p) { return meta(p); }
  if (a === 'blogList') return { ok: true, posts: Object.keys(demoPosts).map(function (k) { return m(demoPosts[k]); }).reverse(), github: { connected: demoGh } };
  if (a === 'blogGet') return demoPosts[d.id] ? { ok: true, post: clone(demoPosts[d.id]) } : { ok: false, error: 'Post not found' };
  if (a === 'blogSave' || a === 'blogPublish') {
    var p = clone(d.post); if (!p.id) { p.id = 'B-DEMO-' + (Object.keys(demoPosts).length + 1); p.created = nowIso(); }
    p.slug = slugify(p.slug || p.title); p.updated = nowIso();
    if (a === 'blogPublish') { p.status = 'Published'; p.liveSlug = p.slug; p.published = p.published || nowIso(); B.demoFiles = d.files; }
    else p.status = (demoPosts[p.id] || {}).status || 'Draft';
    demoPosts[p.id] = p; return { ok: true, post: m(p), url: BASE + 'blog/' + p.slug + '/' };
  }
  if (a === 'blogUnpublish') { var q = demoPosts[d.id]; q.status = 'Draft'; q.liveSlug = ''; B.demoFiles = d.files; return { ok: true, post: m(q) }; }
  if (a === 'blogDelete') { delete demoPosts[d.id]; return { ok: true }; }
  if (a === 'blogUploadImage') return { ok: true, paths: d.images.map(function (i) { return '/assets/blog/' + i.name; }) };
  if (a === 'blogCommit') { B.demoFiles = d.files; return { ok: true }; }
  if (a === 'blogStatus') return { ok: true, connected: demoGh, repo: 'theunposedstory/portfolio' };
  if (a === 'blogSetToken') { demoGh = true; return { ok: true, connected: true }; }
  return { ok: false, error: 'demo' };
}

wire();
window.TUSBlog = { open: open, demo: demo, render: { post: renderPost, index: renderIndex, sitemap: renderSitemap, feed: renderFeed, clean: cleanHtml, analyse: analyse }, state: B };
if (window.__blogPending) { var h = window.__blogPending; window.__blogPending = null; open(h); }
})();
