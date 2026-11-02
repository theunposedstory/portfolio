/* The Unposed Story — Quotation Builder (no frameworks)
 * Data lives in the owner's Google Sheet via the Apps Script web app.
 * Add ?demo=1 to the URL to try it with sample data (nothing is saved). */
(function () {
'use strict';

var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6j075sRufGpEy0IfVm2d_d70qb3Qpj5I5zcgwgMvRd_F6meKwvmrjrebWs4DkloE8tg/exec';
var DEMO = /[?&]demo=1/.test(location.search);
var BRAND = { name: 'The Unposed Story', owner: 'Sandip Lade', phone: '+91 70452 78377', wa: '917045278377',
  email: 'weddings.theunposedstory@gmail.com', insta: '@theunposedstory', web: 'theunposedstory.github.io/portfolio',
  tagline: 'Real moments. Infinite memories.', areas: 'Mumbai • Thane • Navi Mumbai • Pune • Pan India • Destination Weddings' };
var TARGET_MARGIN = 35;   // % — below this the profit meter turns amber
var QSTATUSES = ['Draft', 'Sent', 'Negotiating', 'Accepted', 'Lost'];
var EVENT_PRESETS = ['Pre-wedding shoot', 'Engagement', 'Haldi / Mehendi', 'Sangeet / Cocktail', 'Wedding ceremony', 'Reception'];
var TIMINGS = ['Morning', 'Afternoon', 'Evening', 'Full day', 'Half day', 'To be finalised'];
var TEAM = [
  ['candid', 'Candid photographers', 'Emotional, unposed and artistic moments.'],
  ['trad', 'Traditional photographers', 'Full stage, rituals, guests and family group coverage.'],
  ['cine', 'Cinematographers', 'High-definition 4K footage, creative angles and story-driven filming.'],
  ['tradVideo', 'Traditional videographers', 'Full documentation of rituals, stage, speeches and functions.']
];
var DELIV = [
  ['photos', 'High-resolution edited photographs', 'photo', 'e.g. 400–500'],
  ['raw', 'Complete raw image backup (gallery / drive)', 'photo', ''],
  ['gallery', 'Online gallery for sharing with family', 'photo', ''],
  ['album', 'Premium photo album / photobook', 'photo', 'e.g. 1 album, 30 pages'],
  ['teaser', 'Cinematic teaser / trailer (1–3 min)', 'video', ''],
  ['film', 'Cinematic highlight film (10–25 min)', 'video', ''],
  ['fullVideo', 'Traditional full event video (1–3 hrs)', 'video', ''],
  ['reels', 'Instagram reels / shorts (9:16)', 'video', 'e.g. 3']
];
var PRESETS = {
  Essential: { team: { candid: 1, trad: 1, cine: 0, tradVideo: 0, drone: 'No' }, deliv: { photos: '150–200', raw: true, gallery: true } },
  Silver:    { team: { candid: 1, trad: 1, cine: 0, tradVideo: 1, drone: 'No' }, deliv: { photos: '250–300', raw: true, gallery: true, teaser: true, fullVideo: true } },
  Gold:      { team: { candid: 1, trad: 1, cine: 2, tradVideo: 0, drone: 'Yes, as per schedule' }, deliv: { photos: '400–500', raw: true, gallery: true, album: '1 premium album, 30 pages', teaser: true, film: true } },
  Platinum:  { team: { candid: 1, trad: 1, cine: 1, tradVideo: 1, drone: 'No' }, deliv: { photos: '600–700', raw: true, gallery: true, album: '1 luxury album, 40 pages', teaser: true, film: true, fullVideo: true } },
  Custom:    { team: { candid: 0, trad: 0, cine: 0, tradVideo: 0, drone: 'No' }, deliv: {} }
};
var DEFAULT_TERMS = [
  'Booking confirmation: Dates are reserved only after the agreed booking advance is received.',
  'Advance payment: The booking advance is non-refundable on cancellation by the client, as the team and dates are reserved exclusively.',
  'Date changes: Rescheduling of any event is subject to team availability.',
  'Travel & accommodation: Outstation travel, stay, parking and venue permissions are borne by the client unless included above.',
  'Selection & editing: Editing begins after the client completes photo selection. Colour style follows The Unposed Story aesthetic.',
  'Data storage: Raw and final files are backed up for up to 6 months after the event. Clients are advised to keep personal backups.',
  'Force majeure: The Unposed Story is not responsible for delays caused by weather, equipment failure beyond reasonable control, or venue restrictions.'
];
var PLANS = {
  '30-50-20': { label: '30 / 50 / 20', parts: [[30, 'Booking confirmation (advance)'], [50, 'Before the wedding day'], [20, 'On final delivery']] },
  '50-50':    { label: '50 / 50',      parts: [[50, 'Booking confirmation (advance)'], [50, 'On the wedding day']] }
};

/* ---------------- state ---------------- */
var S = { token: null, prices: [], enquiries: [], quotes: [], sheetUrl: '', q: null, dirty: false, filter: 'All', search: '' };

/* ---------------- helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function inr(n) { n = Math.round(num(n)); return (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN'); }
function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function addDays(iso, n) { var d = new Date((iso || today()) + 'T00:00:00'); d.setDate(d.getDate() + num(n)); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function fmtDate(iso, long) {
  if (!iso) return '';
  var d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-IN', long ? { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' });
}
function waNum(p) { var n = String(p || '').replace(/\D/g, ''); if (n.length === 10) n = '91' + n; if (n.length === 11 && n[0] === '0') n = '91' + n.slice(1); return n.length >= 11 ? n : ''; }
function get(o, k) { return k.split('.').reduce(function (a, b) { return a == null ? a : a[b]; }, o); }
function set(o, k, v) { var p = k.split('.'), last = p.pop(); p.forEach(function (x) { if (o[x] == null) o[x] = {}; o = o[x]; }); o[last] = v; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 2600); }
function busy(on, msg) { $('#busy').hidden = !on; if (msg) $('#busyMsg').textContent = msg; }
function words(n) {
  n = Math.round(num(n)); if (n === 0) return 'Zero';
  var a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(x) { return x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''); }
  function three(x) { return x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x); }
  var out = [], cr = Math.floor(n / 1e7); n %= 1e7;
  var lk = Math.floor(n / 1e5); n %= 1e5; var th = Math.floor(n / 1000); n %= 1000;
  if (cr) out.push(words(cr) + ' Crore'); if (lk) out.push(two(lk) + ' Lakh'); if (th) out.push(two(th) + ' Thousand'); if (n) out.push(three(n));
  return out.join(' ');
}

/* ---------------- API ---------------- */
function api(action, data) {
  if (DEMO) return Promise.resolve(Demo.call(action, data || {}));
  var body = Object.assign({ action: action, token: S.token }, data || {});
  return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok && res.error === 'SESSION_EXPIRED') { lock('Session expired. Please enter your PIN again.'); throw new Error('expired'); }
      return res;
    });
}

/* ---------------- login ---------------- */
function lock(msg) {
  S.token = null; try { sessionStorage.removeItem('tus_tok'); } catch (e) {}
  $('#app').hidden = true; $('#login').hidden = false; $('#loginMsg').textContent = msg || ''; $('#pin').value = ''; $('#pin').focus();
}
$('#loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var btn = e.target.querySelector('button'); btn.disabled = true; $('#loginMsg').textContent = '';
  api('login', { pin: $('#pin').value }).then(function (r) {
    btn.disabled = false;
    if (!r.ok) { $('#loginMsg').textContent = r.error || 'Could not log in'; return; }
    S.token = r.token; try { sessionStorage.setItem('tus_tok', r.token); } catch (e) {}
    if (r.pinCreated) toast('PIN saved. Use it every time you log in.', 4000);
    start();
  }).catch(function () {
    btn.disabled = false;
    $('#loginMsg').innerHTML = 'Couldn’t connect to your Google script. <a href="' + SCRIPT_URL + '" target="_blank" rel="noopener">Test the connection</a>: it should show <b>“enquiries + quotations”</b>. ' +
      'If you see a sign-in page, set <b>Who has access: Anyone</b>; if it doesn’t say “+ quotations”, paste the new Code.gs and deploy a <b>New version</b>.';
  });
});
$('#logout').addEventListener('click', function () { if (!S.dirty || confirm('You have unsaved changes. Lock anyway?')) { S.dirty = false; lock(); } });

function start() {
  busy(true, 'Loading your quotations…');
  return api('bootstrap').then(function (r) {
    busy(false);
    if (!r.ok) { lock(r.error); return; }
    S.prices = r.prices || []; S.enquiries = r.enquiries || []; S.quotes = r.quotes || []; S.sheetUrl = r.sheetUrl || '';
    $('#sheetLink').href = S.sheetUrl || '#'; $('#sheetLink').hidden = !S.sheetUrl;
    $('#login').hidden = true; $('#app').hidden = false;
    route();
  }).catch(function () { busy(false); });
}
function refreshData() { return api('bootstrap').then(function (r) { if (r.ok) { S.quotes = r.quotes; S.enquiries = r.enquiries; S.prices = r.prices; if (!$('#dashboard').hidden) renderDashboard(); } }).catch(function () {}); }

/* ---------------- routing ---------------- */
window.addEventListener('hashchange', function () { if (S.token || DEMO) route(); });
function route() {
  var h = location.hash.replace('#', '');
  $$('.tabs a').forEach(function (a) { a.classList.toggle('on', (h === '' || h === 'dashboard') ? a.dataset.tab === 'dashboard' : false); });
  if (h.indexOf('q/') === 0) return openQuote(decodeURIComponent(h.slice(2)));
  if (h.indexOf('enq/') === 0) return newQuote(decodeURIComponent(h.slice(4)));
  if (h === 'new') return newQuote();
  showView('dashboard'); renderDashboard();
}
function showView(v) {
  $('#dashboard').hidden = v !== 'dashboard'; $('#editor').hidden = v !== 'editor';
  window.scrollTo(0, 0);
}
window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- dashboard ---------------- */
function renderDashboard() {
  var Q = S.quotes, month = today().slice(0, 7);
  var sum = function (arr, k) { return arr.reduce(function (s, x) { return s + num(x[k]); }, 0); };
  var acc = Q.filter(function (q) { return q.status === 'Accepted'; });
  var lost = Q.filter(function (q) { return q.status === 'Lost'; });
  var open = Q.filter(function (q) { return q.status === 'Sent' || q.status === 'Negotiating'; });
  var thisMonth = Q.filter(function (q) { return String(q.created).slice(0, 7) === month; });
  var conv = acc.length + lost.length ? Math.round(acc.length / (acc.length + lost.length) * 100) + '%' : '—';
  var mgBase = Q.filter(function (q) { return q.status !== 'Draft' && q.final > 0; });
  var avgMg = mgBase.length ? (mgBase.reduce(function (s, q) { return s + num(q.margin); }, 0) / mgBase.length).toFixed(1) + '%' : '—';
  var kp = [
    ['Quotes this month', thisMonth.length, Q.length + ' in total'],
    ['Open pipeline', inr(sum(open, 'final')), open.length + ' sent / negotiating'],
    ['Booked value', inr(sum(acc, 'final')), acc.length + ' accepted'],
    ['Collected', inr(sum(Q, 'paid')), 'Outstanding ' + inr(sum(acc, 'balance'))],
    ['Conversion', conv, 'accepted ÷ (accepted + lost)'],
    ['Avg margin', avgMg, 'private · excl. drafts', 'private']
  ];
  $('#kpis').innerHTML = kp.map(function (k) { return '<div class="kpi ' + (k[3] || '') + '"><small>' + k[0] + '</small><b>' + esc(k[1]) + '</b><span>' + esc(k[2]) + '</span></div>'; }).join('');

  var quotedRefs = {}; Q.forEach(function (q) { if (q.ref) quotedRefs[q.ref] = 1; });
  var wait = S.enquiries.filter(function (e) { return !quotedRefs[e.ref] && ['New', 'Contacted', 'Call booked'].indexOf(e.status) >= 0; }).slice(0, 12);
  $('#awaitCount').textContent = wait.length ? wait.length + ' waiting' : '';
  $('#awaiting').innerHTML = wait.length ? wait.map(function (e) {
    return '<div class="await"><div><b>' + esc(e.name) + (e.partner ? ' &amp; ' + esc(e.partner) : '') + '</b><span>' + esc(fmtDate(e.date) || 'Date TBC') + ' · ' + esc(e.package || 'Not sure') + ' · ' + esc(e.ref) + '</span></div>' +
      '<button class="btn btn-dark" data-enq="' + esc(e.ref) + '">Quote</button></div>';
  }).join('') : '<div class="empty">All caught up. Every enquiry has a quote.</div>';
  $$('#awaiting [data-enq]').forEach(function (b) { b.onclick = function () { location.hash = 'enq/' + encodeURIComponent(b.dataset.enq); }; });

  var chips = ['All'].concat(QSTATUSES);
  $('#statusChips').innerHTML = chips.map(function (c) {
    var n = c === 'All' ? Q.length : Q.filter(function (q) { return q.status === c; }).length;
    return '<button class="chip' + (S.filter === c ? ' on' : '') + '" data-f="' + c + '">' + c + ' (' + n + ')</button>';
  }).join('');
  $$('#statusChips .chip').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.f; renderDashboard(); }; });

  var s = S.search.toLowerCase();
  var list = Q.filter(function (q) {
    return (S.filter === 'All' || q.status === S.filter) && (!s || (q.no + ' ' + q.client + ' ' + q.partner + ' ' + q.phone + ' ' + q.venue).toLowerCase().indexOf(s) >= 0);
  });
  $('#quoteList').innerHTML = list.length ? '<div class="qrow head"><span>Quote</span><span>Client</span><span class="dt">Wedding</span><span>Amount</span><span class="mg-cell">Margin</span><span>Status</span><span></span></div>' +
    list.map(function (q) {
      var m = num(q.margin), cls = m >= TARGET_MARGIN ? 'good' : m >= 20 ? 'ok' : 'bad';
      return '<div class="qrow"><span class="no">' + esc(q.no) + '</span>' +
        '<span class="client"><b>' + esc(q.client) + (q.partner ? ' &amp; ' + esc(q.partner) : '') + '</b><span>' + esc(q.venue || '') + '</span></span>' +
        '<span class="dt">' + esc(fmtDate(q.date) || '—') + '</span>' +
        '<span class="amt">' + inr(q.final) + (q.paid ? '<br><small class="muted">paid ' + inr(q.paid) + '</small>' : '') + '</span>' +
        '<span class="mg-cell"><span class="mg ' + cls + '">' + m.toFixed(1) + '%</span></span>' +
        '<select data-st="' + esc(q.no) + '">' + QSTATUSES.map(function (x) { return '<option' + (x === q.status ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
        '<span class="row-acts"><button class="btn btn-line" data-pv="' + esc(q.no) + '">Preview</button><button class="btn btn-dark" data-open="' + esc(q.no) + '">Open</button></span></div>';
    }).join('') : '<div class="empty">' + (Q.length ? 'No quotations match this filter.' : 'No quotations yet. Create your first one.') + '</div>';
  $$('#quoteList [data-pv]').forEach(function (b) { b.onclick = function () { previewSaved(b.dataset.pv); }; });
  $$('#quoteList [data-open]').forEach(function (b) { b.onclick = function () { location.hash = 'q/' + encodeURIComponent(b.dataset.open); }; });
  $$('#quoteList [data-st]').forEach(function (sel) {
    sel.onchange = function () {
      var no = sel.dataset.st, st = sel.value;
      api('setStatus', { id: no, status: st }).then(function (r) {
        if (!r.ok) return toast(r.error || 'Could not update');
        S.quotes.forEach(function (q) { if (q.no === no) q.status = st; }); renderDashboard(); toast(no + ' marked ' + st);
      });
    };
  });
}
$('#search').addEventListener('input', function (e) { S.search = e.target.value; renderDashboard(); });

/* ---------------- quote model ---------------- */
function priceOf(name) { return S.prices.filter(function (p) { return p.name === name; })[0]; }
function packages() { return S.prices.filter(function (p) { return p.type === 'Package'; }); }
function addonsList() { return S.prices.filter(function (p) { return p.type !== 'Package'; }); }

function blankQuote() {
  var q = {
    no: null, status: 'Draft', ref: '', client: { name: '', partner: '', phone: '', email: '', date: '', venue: '', guests: '' },
    events: EVENT_PRESETS.map(function (n) { return { on: n === 'Wedding ceremony', name: n, date: '', venue: '', timing: n === 'Wedding ceremony' ? 'Full day' : '' }; }),
    pkg: 'Gold', days: 1, addons: {}, custom: [], travel: { charge: 0, cost: 0 }, extraCosts: [],
    team: {}, deliv: {}, delivMode: 'Google Drive cloud link + USB pen drive',
    budget: '', discount: { type: 'amt', value: '' }, round: '500', plan: '30-50-20',
    quoteDate: today(), validDays: 7, notes: '', internal: '', terms: DEFAULT_TERMS.slice(), payments: []
  };
  applyPreset(q, q.pkg);
  return q;
}
function applyPreset(q, pkg) { var p = PRESETS[pkg] || PRESETS.Custom; q.team = clone(p.team); q.deliv = clone(p.deliv); }

function compute(q) {
  var pk = q.pkg !== 'Custom' ? priceOf(q.pkg) : null, days = Math.max(1, num(q.days) || 1);
  var lines = [], cost = [], unconfirmed = [];
  if (pk) {
    lines.push({ label: pk.name + ' package' + (days > 1 ? ' × ' + days + ' days' : ''), amount: pk.price * days, kind: 'pkg' });
    cost.push([pk.name + ' package' + (days > 1 ? ' × ' + days : ''), pk.cost * days]); if (!pk.costConfirmed) unconfirmed.push(pk.name);
  }
  addonsList().forEach(function (a) {
    var n = num(q.addons[a.name]); if (n > 0) {
      lines.push({ label: a.name + (n > 1 ? ' × ' + n : ''), amount: a.price * n, kind: 'addon', name: a.name, unit: a.price, qty: n });
      cost.push([a.name + (n > 1 ? ' × ' + n : ''), a.cost * n]); if (!a.costConfirmed) unconfirmed.push(a.name);
    }
  });
  (q.custom || []).forEach(function (c) {
    if (!c.desc && !num(c.price)) return; var n = Math.max(1, num(c.qty) || 1);
    lines.push({ label: (c.desc || 'Custom item') + (n > 1 ? ' × ' + n : ''), amount: num(c.price) * n, kind: 'custom', unit: num(c.price), qty: n, desc: c.desc });
    cost.push([(c.desc || 'Custom item') + (n > 1 ? ' × ' + n : ''), num(c.cost) * n]);
  });
  if (num(q.travel.charge)) lines.push({ label: 'Travel & stay', amount: num(q.travel.charge), kind: 'travel' });
  if (num(q.travel.cost)) cost.push(['Travel & stay', num(q.travel.cost)]);
  (q.extraCosts || []).forEach(function (x) { if (num(x.amount)) cost.push([x.desc || 'Other cost', num(x.amount)]); });

  var subtotal = lines.reduce(function (s, l) { return s + l.amount; }, 0);
  var disc = q.discount.type === 'pct' ? subtotal * num(q.discount.value) / 100 : num(q.discount.value);
  disc = Math.min(Math.max(disc, 0), subtotal);
  var fin = subtotal - disc, r = num(q.round);
  if (r > 0 && fin > 0) fin = Math.round(fin / r) * r;
  var discount = subtotal - fin;
  var totalCost = cost.reduce(function (s, c) { return s + num(c[1]); }, 0);
  var profit = fin - totalCost, margin = fin > 0 ? profit / fin * 100 : 0;
  var budget = num(q.budget), gap = budget > 0 ? fin - budget : 0;
  var plan = PLANS[q.plan] || PLANS['30-50-20'], acc = 0;
  var milestones = plan.parts.map(function (p, i) {
    var amt = i === plan.parts.length - 1 ? fin - acc : Math.round(fin * p[0] / 100 / 100) * 100; acc += amt;
    return { pct: p[0], label: p[1], amount: amt };
  });
  var paid = (q.payments || []).filter(function (p) { return p.status !== 'Void'; }).reduce(function (s, p) { return s + num(p.amount); }, 0);
  return { lines: lines, cost: cost, unconfirmed: unconfirmed, subtotal: subtotal, discount: discount, final: fin, totalCost: totalCost,
           profit: profit, margin: margin, budget: budget, gap: gap, milestones: milestones, planLabel: plan.label, paid: paid, balance: fin - paid,
           validUntil: addDays(q.quoteDate, q.validDays) };
}

/* ---------------- editor ---------------- */
function newQuote(enqRef) {
  if (S.dirty && !confirm('Discard unsaved changes?')) return;
  S.q = blankQuote();
  if (enqRef) {
    var e = S.enquiries.filter(function (x) { return x.ref === enqRef; })[0];
    if (e) fillFromEnquiry(S.q, e);
  } else {
    try { var d = JSON.parse(localStorage.getItem('tus_draft') || 'null'); if (d && !d.no && d.client && d.client.name && confirm('Restore your unsaved draft for ' + d.client.name + '?')) S.q = d; } catch (x) {}
  }
  S.dirty = false; renderEditor(); showView('editor');
  $$('.tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.tab === 'editor'); });
}
function fillFromEnquiry(q, e) {
  q.ref = e.ref;
  q.client = { name: e.name || '', partner: e.partner || '', phone: e.phone || '', email: e.email || '', date: e.date || '', venue: e.location || '', guests: e.guests || '' };
  if (e.package && PRESETS[e.package]) { q.pkg = e.package; applyPreset(q, q.pkg); }
  q.events.forEach(function (ev) { if (ev.name === 'Wedding ceremony') { ev.date = e.date || ''; ev.venue = e.location || ''; } });
  if (/haldi|mehendi/i.test(e.message || '')) q.events.forEach(function (ev) { if (/Haldi/.test(ev.name)) ev.on = true; });
  if (/sangeet|cocktail/i.test(e.message || '')) q.events.forEach(function (ev) { if (/Sangeet/.test(ev.name)) ev.on = true; });
  if (/reception/i.test(e.message || '')) q.events.forEach(function (ev) { if (/Reception/.test(ev.name)) ev.on = true; });
}
function openQuote(no) {
  if (S.dirty && !confirm('Discard unsaved changes?')) return;
  busy(true, 'Opening ' + no + '…');
  api('getQuote', { id: no }).then(function (r) {
    busy(false);
    if (!r.ok) { toast(r.error || 'Not found'); location.hash = 'dashboard'; return; }
    var q = Object.assign(blankQuote(), r.quote); q.no = no; q.status = r.quote.status || 'Draft';
    S.q = q; S.dirty = false; renderEditor(); showView('editor');
  }).catch(function () { busy(false); });
}
function markDirty() {
  S.dirty = true; $('#saveState').textContent = 'Unsaved changes';
  try { localStorage.setItem('tus_draft', JSON.stringify(S.q)); } catch (e) {}
}

function renderEditor() {
  var q = S.q;
  $('#edTitle').textContent = q.no ? q.no + ' · ' + (q.client.name || 'Client') : 'New quote';
  $('#edStatusLine').textContent = q.no ? 'Quotation' + (q.ref ? ' · from enquiry ' + q.ref : '') : 'New quotation' + (q.ref ? ' · from enquiry ' + q.ref : '');
  $('#sumNo').textContent = q.no || 'Not saved yet';
  $('#saveState').textContent = q.no ? 'Saved' : '';
  $('#qStatus').innerHTML = QSTATUSES.map(function (s) { return '<option' + (s === q.status ? ' selected' : '') + '>' + s + '</option>'; }).join('');
  $('#enqPick').innerHTML = '<option value="">Enter details manually</option>' + S.enquiries.slice(0, 80).map(function (e) {
    return '<option value="' + esc(e.ref) + '"' + (e.ref === q.ref ? ' selected' : '') + '>' + esc(e.ref + ' · ' + e.name + (e.date ? ' · ' + fmtDate(e.date) : '')) + '</option>';
  }).join('');
  $$('[data-k]').forEach(function (el) { var v = get(q, el.dataset.k); el.value = v == null ? '' : v; });
  renderEvents(); renderPackages(); renderAddons(); renderCustom(); renderTeam(); renderDeliv(); renderTerms(); renderExtraCosts(); renderPayments();
  recalc();
}

/* generic bound inputs */
$$('#editor [data-k]').forEach(function (el) {
  el.addEventListener('input', function () {
    var v = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    set(S.q, el.dataset.k, v); markDirty(); recalc();
  });
});
$('#qStatus').addEventListener('change', function (e) { S.q.status = e.target.value; markDirty(); });
$('#enqPick').addEventListener('change', function (e) {
  var en = S.enquiries.filter(function (x) { return x.ref === e.target.value; })[0];
  if (!en) { S.q.ref = ''; markDirty(); return; }
  fillFromEnquiry(S.q, en); markDirty(); renderEditor();
});

function renderEvents() {
  $('#events').innerHTML = S.q.events.map(function (ev, i) {
    return '<div class="ev' + (ev.on ? '' : ' off') + '" data-i="' + i + '">' +
      '<input type="checkbox" data-f="on"' + (ev.on ? ' checked' : '') + ' aria-label="Include ' + esc(ev.name) + '">' +
      '<input data-f="name" value="' + esc(ev.name) + '" aria-label="Event name">' +
      '<input data-f="date" type="date" value="' + esc(ev.date) + '" aria-label="Date">' +
      '<input data-f="venue" value="' + esc(ev.venue) + '" placeholder="Venue & location" aria-label="Venue">' +
      '<select data-f="timing" aria-label="Timing"><option value="">Timing</option>' + TIMINGS.map(function (t) { return '<option' + (t === ev.timing ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
      '<button class="x" type="button" data-del aria-label="Remove event">×</button></div>';
  }).join('');
  $$('#events .ev').forEach(function (row) {
    var i = +row.dataset.i;
    $$('[data-f]', row).forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
        S.q.events[i][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'checkbox') row.classList.toggle('off', !el.checked);
        markDirty();
      });
    });
    $('[data-del]', row).onclick = function () { S.q.events.splice(i, 1); markDirty(); renderEvents(); };
  });
}
$('#addEvent').onclick = function () { S.q.events.push({ on: true, name: '', date: '', venue: '', timing: '' }); markDirty(); renderEvents(); };

function renderPackages() {
  var list = packages().map(function (p) { return { name: p.name, price: p.price }; }).concat([{ name: 'Custom', price: null }]);
  $('#pkgCards').innerHTML = list.map(function (p) {
    return '<button type="button" class="pkg' + (S.q.pkg === p.name ? ' on' : '') + '" data-p="' + esc(p.name) + '"><b>' + esc(p.name) + '</b><span>' + (p.price == null ? 'Build from items' : inr(p.price) + ' / day') + '</span></button>';
  }).join('');
  $$('#pkgCards .pkg').forEach(function (b) {
    b.onclick = function () { S.q.pkg = b.dataset.p; applyPreset(S.q, S.q.pkg); markDirty(); renderPackages(); renderTeam(); renderDeliv(); recalc(); };
  });
}
function renderAddons() {
  $('#addons').innerHTML = addonsList().map(function (a) {
    var n = num(S.q.addons[a.name]);
    return '<div class="ad' + (n ? ' on' : '') + '"><div><b>' + esc(a.name) + '</b><span>' + inr(a.price) + (a.inclusions[0] ? ' · ' + esc(a.inclusions[0]) : '') + '</span></div>' +
      '<div class="step"><button type="button" data-a="' + esc(a.name) + '" data-d="-1" aria-label="Less">−</button><output>' + n + '</output><button type="button" data-a="' + esc(a.name) + '" data-d="1" aria-label="More">+</button></div></div>';
  }).join('') || '<p class="muted small">No add-ons in your Price list sheet.</p>';
  $$('#addons [data-a]').forEach(function (b) {
    b.onclick = function () { var k = b.dataset.a; S.q.addons[k] = Math.max(0, num(S.q.addons[k]) + num(b.dataset.d)); if (!S.q.addons[k]) delete S.q.addons[k]; markDirty(); renderAddons(); recalc(); };
  });
}
function renderCustom() {
  $('#custom').innerHTML = (S.q.custom || []).map(function (c, i) {
    return '<div class="cust" data-i="' + i + '"><input data-f="desc" value="' + esc(c.desc) + '" placeholder="Item, e.g. Extra cinematographer for Sangeet">' +
      '<input data-f="qty" type="number" min="1" value="' + esc(c.qty || 1) + '" aria-label="Quantity">' +
      '<input data-f="price" type="number" min="0" step="500" value="' + esc(c.price) + '" placeholder="Price ₹" aria-label="Client price">' +
      '<input data-f="cost" class="private" type="number" min="0" step="500" value="' + esc(c.cost) + '" placeholder="Your cost ₹" aria-label="Your cost (private)">' +
      '<button class="x" type="button" data-del aria-label="Remove">×</button></div>';
  }).join('');
  $$('#custom .cust').forEach(function (row) {
    var i = +row.dataset.i;
    $$('[data-f]', row).forEach(function (el) { el.oninput = function () { S.q.custom[i][el.dataset.f] = el.type === 'number' ? num(el.value) : el.value; markDirty(); recalc(); }; });
    $('[data-del]', row).onclick = function () { S.q.custom.splice(i, 1); markDirty(); renderCustom(); recalc(); };
  });
}
$('#addCustom').onclick = function () { S.q.custom.push({ desc: '', qty: 1, price: '', cost: '' }); markDirty(); renderCustom(); };

function renderTeam() {
  var t = S.q.team;
  $('#team').innerHTML = TEAM.map(function (r) {
    return '<label>' + r[1] + '<input type="number" min="0" max="10" data-t="' + r[0] + '" value="' + num(t[r[0]]) + '"></label>';
  }).join('') + '<label>Drone / aerial<select data-t="drone">' + ['No', 'Yes, as per schedule', 'Yes, all events', 'Optional'].map(function (o) { return '<option' + (t.drone === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
  $$('#team [data-t]').forEach(function (el) { el.oninput = el.onchange = function () { S.q.team[el.dataset.t] = el.type === 'number' ? num(el.value) : el.value; markDirty(); }; });
}
function renderDeliv() {
  var d = S.q.deliv;
  $('#deliv').innerHTML = DELIV.map(function (r) {
    var on = !!d[r[0]], hasQty = !!r[3];
    return '<div class="dv"><input type="checkbox" data-d="' + r[0] + '"' + (on ? ' checked' : '') + ' id="dv_' + r[0] + '"><span><label for="dv_' + r[0] + '" style="all:unset;cursor:pointer">' + r[1] + '</label></span>' +
      (hasQty ? '<input class="q" data-dq="' + r[0] + '" value="' + esc(typeof d[r[0]] === 'string' ? d[r[0]] : '') + '" placeholder="' + esc(r[3]) + '">' : '') + '</div>';
  }).join('') + '<label class="full" style="grid-column:1/-1;margin-top:6px">Delivery mode<input id="delivMode" value="' + esc(S.q.delivMode) + '"></label>';
  $$('#deliv [data-d]').forEach(function (cb) {
    cb.onchange = function () { var k = cb.dataset.d, qi = $('[data-dq="' + k + '"]'); S.q.deliv[k] = cb.checked ? ((qi && qi.value) || true) : false; markDirty(); };
  });
  $$('#deliv [data-dq]').forEach(function (inp) {
    inp.oninput = function () { var k = inp.dataset.dq; S.q.deliv[k] = inp.value || true; $('[data-d="' + k + '"]').checked = true; markDirty(); };
  });
  $('#delivMode').oninput = function (e) { S.q.delivMode = e.target.value; markDirty(); };
}
function renderTerms() {
  $('#terms').innerHTML = S.q.terms.map(function (t, i) {
    return '<div class="term"><textarea data-i="' + i + '" rows="2">' + esc(t) + '</textarea><button class="x" type="button" data-del="' + i + '" aria-label="Remove term">×</button></div>';
  }).join('');
  $$('#terms textarea').forEach(function (ta) { ta.oninput = function () { S.q.terms[+ta.dataset.i] = ta.value; markDirty(); }; });
  $$('#terms [data-del]').forEach(function (b) { b.onclick = function () { S.q.terms.splice(+b.dataset.del, 1); markDirty(); renderTerms(); }; });
}
$('#addTerm').onclick = function () { S.q.terms.push(''); markDirty(); renderTerms(); };
function renderExtraCosts() {
  $('#extraCosts').innerHTML = (S.q.extraCosts || []).map(function (x, i) {
    return '<div class="xc" data-i="' + i + '"><input data-f="desc" value="' + esc(x.desc) + '" placeholder="e.g. Assistant, outstation stay"><input data-f="amount" type="number" min="0" step="500" value="' + esc(x.amount) + '" placeholder="₹"><button class="x" type="button" data-del aria-label="Remove">×</button></div>';
  }).join('');
  $$('#extraCosts .xc').forEach(function (row) {
    var i = +row.dataset.i;
    $$('[data-f]', row).forEach(function (el) { el.oninput = function () { S.q.extraCosts[i][el.dataset.f] = el.type === 'number' ? num(el.value) : el.value; markDirty(); recalc(); }; });
    $('[data-del]', row).onclick = function () { S.q.extraCosts.splice(i, 1); markDirty(); renderExtraCosts(); recalc(); };
  });
}
$('#addCost').onclick = function () { S.q.extraCosts.push({ desc: '', amount: '' }); markDirty(); renderExtraCosts(); };

/* ---------------- live summary ---------------- */
function recalc() {
  var q = S.q, t = compute(q);
  q.totals = { subtotal: t.subtotal, discount: t.discount, final: t.final, gap: t.gap, cost: t.totalCost, profit: t.profit, margin: t.margin };
  q.planLabel = t.planLabel; q.validUntil = t.validUntil;
  $('#validUntil').value = fmtDate(t.validUntil, true);

  $('#sumLines').innerHTML = t.lines.map(function (l) { return '<div><span>' + esc(l.label) + '</span><span>' + inr(l.amount) + '</span></div>'; }).join('') +
    (t.lines.length ? '<div><span><b>Subtotal</b></span><span><b>' + inr(t.subtotal) + '</b></span></div>' : '<div><span class="muted">Choose a package or add items</span><span></span></div>') +
    (t.discount ? '<div class="disc"><span>Discount' + (q.discount.type === 'pct' && num(q.discount.value) ? ' (' + num(q.discount.value) + '%)' : '') + '</span><span>−' + inr(t.discount) + '</span></div>' : '');
  $('#sumFinal').textContent = inr(t.final); $('#mFinal').textContent = inr(t.final);

  var bb = $('#budgetBox'), chip = $('#mGap');
  if (t.budget > 0) {
    var cls = t.gap > 0 ? 'over' : t.gap < 0 ? 'under' : 'match';
    bb.className = 'budget ' + cls;
    bb.innerHTML = 'Client budget <b>' + inr(t.budget) + '</b><br>' + (t.gap > 0 ? 'Quote is <b>' + inr(t.gap) + ' over</b> budget (' + (t.gap / t.budget * 100).toFixed(0) + '%)' : t.gap < 0 ? 'Quote is <b>' + inr(-t.gap) + ' under</b> budget' : 'Quote matches the budget exactly');
    chip.className = 'gap-chip ' + (t.gap > 0 ? 'over' : 'under'); chip.textContent = t.gap > 0 ? '+' + inr(t.gap) : t.gap < 0 ? inr(t.gap) : '=';
  } else { bb.innerHTML = ''; bb.className = 'budget'; chip.textContent = ''; chip.className = 'gap-chip'; }

  var m = t.margin, col = m >= TARGET_MARGIN ? '#1F7A4D' : m >= 20 ? '#B8893E' : '#B3261E';
  $('#profitBox').innerHTML = t.final ? '<div class="row"><span>Your cost</span><span>' + inr(t.totalCost) + '</span></div><div class="row"><span>Profit</span><b style="color:' + col + '">' + inr(t.profit) + ' · ' + m.toFixed(1) + '%</b></div>' +
    '<div class="meter"><i style="width:' + Math.max(0, Math.min(100, m)) + '%;background:' + col + '"></i></div><div class="small muted" style="margin-top:4px">Private · target ' + TARGET_MARGIN + '% margin</div>' : '';

  $('#costTable').innerHTML = t.cost.map(function (c) { return '<div><span>' + esc(c[0]) + '</span><span>' + inr(c[1]) + '</span></div>'; }).join('') +
    '<div><b>Total cost</b><b>' + inr(t.totalCost) + '</b></div><div><b>Profit</b><b style="color:' + col + '">' + inr(t.profit) + ' (' + m.toFixed(1) + '%)</b></div>';
  var w = $('#costWarn');
  w.hidden = !t.unconfirmed.length;
  w.innerHTML = t.unconfirmed.length ? 'Sample cost estimates in use for: <b>' + esc(t.unconfirmed.join(', ')) + '</b>. Update your real costs in the <b>Price list</b> tab of your sheet and set “Cost confirmed?” to Yes.' : '';

  $('#planPreview').innerHTML = t.milestones.map(function (x) { return '<div><span>' + x.pct + '% · ' + esc(x.label) + '</span><b>' + inr(x.amount) + '</b></div>'; }).join('');
  renderSuggestions(t);
  renderPayTotals(t);
}

function renderSuggestions(t) {
  var q = S.q, box = $('#suggest'), out = [];
  if (t.budget > 0 && t.gap > 0) {
    out.push('<p>Ways to fit ' + inr(t.budget) + '</p>');
    t.lines.filter(function (l) { return l.kind === 'addon'; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 4).forEach(function (l) {
      out.push(sg('Remove ' + l.name + ' (−' + inr(l.amount) + ')', 'rm:' + l.name));
    });
    var pk = packages(), idx = pk.map(function (p) { return p.name; }).indexOf(q.pkg);
    if (idx > 0) { var lower = pk[idx - 1]; out.push(sg('Switch to ' + lower.name + ' (−' + inr((pk[idx].price - lower.price) * Math.max(1, num(q.days))) + ')', 'pkg:' + lower.name)); }
    var needPct = t.gap / t.subtotal * 100, mAfter = t.final - t.gap > 0 ? (t.profit - t.gap) / (t.final - t.gap) * 100 : 0;
    out.push(sg('Discount ' + inr(t.gap) + ' (' + needPct.toFixed(1) + '%) · margin falls to ' + mAfter.toFixed(1) + '%' + (mAfter < TARGET_MARGIN ? ' ⚠' : ''), 'disc:' + Math.round(t.gap + t.discount)));
  } else if (t.budget > 0 && t.gap < 0) {
    var room = -t.gap;
    out.push('<p>' + inr(room) + ' headroom: upsell ideas</p>');
    addonsList().filter(function (a) { return !num(q.addons[a.name]) && a.price <= room; }).sort(function (a, b) { return (b.price - b.cost) - (a.price - a.cost); }).slice(0, 3).forEach(function (a) {
      out.push(sg('Add ' + a.name + ' (+' + inr(a.price) + ')', 'add:' + a.name));
    });
    var pk2 = packages(), i2 = pk2.map(function (p) { return p.name; }).indexOf(q.pkg);
    if (i2 >= 0 && i2 < pk2.length - 1) { var up = pk2[i2 + 1], diff = (up.price - pk2[i2].price) * Math.max(1, num(q.days)); if (diff <= room * 1.15) out.push(sg('Upgrade to ' + up.name + ' (+' + inr(diff) + ')', 'pkg:' + up.name)); }
    if (t.discount > 0) out.push(sg('Remove the discount (+' + inr(Math.min(t.discount, room)) + ')', 'disc:0'));
  }
  box.innerHTML = out.length > 1 ? out.join('') : '';
  $$('#suggest [data-sg]').forEach(function (b) {
    b.onclick = function () {
      var a = b.dataset.sg.split(':'), k = a[0], v = a.slice(1).join(':');
      if (k === 'rm') delete q.addons[v];
      if (k === 'add') q.addons[v] = 1;
      if (k === 'pkg') { q.pkg = v; applyPreset(q, v); renderPackages(); renderTeam(); renderDeliv(); }
      if (k === 'disc') { q.discount = { type: 'amt', value: num(v) }; $('[data-k="discount.value"]').value = num(v) || ''; $('[data-k="discount.type"]').value = 'amt'; }
      markDirty(); renderAddons(); recalc(); toast('Applied');
    };
  });
  function sg(text, act) { return '<div class="sg"><span>' + esc(text) + '</span><button class="btn btn-line" data-sg="' + esc(act) + '">Apply</button></div>'; }
}

/* ---------------- save ---------------- */
function validate() {
  var q = S.q;
  if (!q.client.name) { toast('Add the client name first'); $('[data-k="client.name"]').focus(); return false; }
  if (!compute(q).final) { toast('Choose a package or add an item first'); return false; }
  return true;
}
function save(silent) {
  if (!validate()) return Promise.reject(new Error('invalid'));
  recalc();
  var btns = [$('#saveBtn'), $('#mSave')]; btns.forEach(function (b) { b.disabled = true; });
  if (!silent) busy(true, 'Saving to your Google Sheet…');
  return api('saveQuote', { quote: S.q }).then(function (r) {
    busy(false); btns.forEach(function (b) { b.disabled = false; });
    if (!r.ok) { toast(r.error || 'Could not save'); throw new Error('save'); }
    var isNew = !S.q.no;
    S.q.no = r.no; S.q.payments = r.payments || S.q.payments; S.dirty = false;
    try { localStorage.removeItem('tus_draft'); } catch (e) {}
    $('#saveState').textContent = 'Saved ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    $('#edTitle').textContent = S.q.no + ' · ' + S.q.client.name; $('#sumNo').textContent = S.q.no;
    if (isNew) { history.replaceState(null, '', '#q/' + encodeURIComponent(S.q.no)); toast('Saved as ' + S.q.no); } else if (!silent) toast('Saved');
    renderPayments(); refreshData();
    return r;
  }, function (e) { busy(false); btns.forEach(function (b) { b.disabled = false; }); toast('Could not reach Google. Your draft is kept on this device.'); throw e; });
}
$('#saveBtn').onclick = function () { save().catch(function () {}); };
$('#mSave').onclick = function () { save().catch(function () {}); };
$('#mSummary').onclick = function () { $('.ed-side').scrollIntoView({ behavior: 'smooth' }); };
$('#dupBtn').onclick = function () {
  var c = clone(S.q); c.no = null; c.status = 'Draft'; c.payments = []; c.quoteDate = today();
  S.q = c; S.dirty = true; history.replaceState(null, '', '#new'); renderEditor(); toast('Copied. Edit and save as a new quote.');
};

/* ---------------- payments ---------------- */
function renderPayments() {
  var q = S.q;
  $('#payLocked').hidden = !!q.no; $('#payArea').hidden = !q.no;
  if (!q.no) return;
  var t = compute(q);
  $('#payDate').value = $('#payDate').value || today();
  $('#payMilestone').innerHTML = t.milestones.map(function (m) { return '<option>' + esc(m.label + ' (' + m.pct + '%)') + '</option>'; }).join('') + '<option>Part payment</option><option>Add-on / extra</option>';
  var paidCount = (q.payments || []).filter(function (p) { return p.status !== 'Void'; }).length;
  var next = t.milestones[Math.min(paidCount, t.milestones.length - 1)];
  $('#payMilestone').selectedIndex = Math.min(paidCount, t.milestones.length - 1);
  if (!$('#payAmt').value && next) $('#payAmt').value = Math.min(next.amount, Math.max(t.balance, 0)) || '';
  $('#payList').innerHTML = (q.payments || []).slice().reverse().map(function (p) {
    return '<div class="pay' + (p.status === 'Void' ? ' void' : '') + '"><span class="rno">' + esc(p.receiptNo) + '</span>' +
      '<div><span class="amt">' + inr(p.amount) + '</span> <span class="meta">· ' + esc(fmtDate(p.date)) + ' · ' + esc(p.mode) + (p.txn ? ' · ' + esc(p.txn) : '') + '<br>' + esc(p.milestone) + (p.status === 'Void' ? ' · CANCELLED' : '') + '</span></div>' +
      '<div class="acts">' + (p.status !== 'Void' ? '<button class="btn btn-wa" data-rshare="' + esc(p.receiptNo) + '">View receipt</button><button class="btn btn-line" data-void="' + esc(p.receiptNo) + '">Cancel</button>' : '') + '</div></div>';
  }).join('') || '<div class="empty">No payments recorded yet.</div>';
  $$('[data-rshare]').forEach(function (b) { b.onclick = function () { receiptPdf(b.dataset.rshare); }; });
  $$('[data-void]').forEach(function (b) {
    b.onclick = function () {
      if (!confirm('Cancel receipt ' + b.dataset.void + '? It stays in your records marked as cancelled.')) return;
      busy(true, 'Cancelling receipt…');
      api('voidPayment', { id: q.no, receiptNo: b.dataset.void }).then(function (r) {
        busy(false); if (!r.ok) return toast(r.error);
        q.payments = r.payments; renderPayments(); recalc(); refreshData(); toast('Receipt cancelled');
      }).catch(function () { busy(false); });
    };
  });
  renderPayTotals(t);
}
function renderPayTotals(t) {
  if (!S.q.no) return;
  $('#payTotals').innerHTML = '<div><small>Total</small><b>' + inr(t.final) + '</b></div><div><small>Received</small><b>' + inr(t.paid) + '</b></div><div class="bal"><small>Balance</small><b>' + inr(t.balance) + '</b></div>';
}
$('#payAdd').onclick = function () {
  var q = S.q, amt = num($('#payAmt').value);
  if (amt <= 0) { toast('Enter the amount received'); $('#payAmt').focus(); return; }
  var go = function () {
    busy(true, 'Recording payment…');
    return api('addPayment', { id: q.no, payment: { date: $('#payDate').value, amount: amt, milestone: $('#payMilestone').value, mode: $('#payMode').value, txn: $('#payTxn').value, note: $('#payNote').value } })
      .then(function (r) {
        busy(false); if (!r.ok) return toast(r.error || 'Could not record');
        q.payments = r.payments; if (r.status) { q.status = r.status; $('#qStatus').value = r.status; }
        $('#payAmt').value = ''; $('#payTxn').value = ''; $('#payNote').value = '';
        renderPayments(); recalc(); refreshData();
        toast('Receipt ' + r.payment.receiptNo + ' created');
        receiptPdf(r.payment.receiptNo);
      }).catch(function () { busy(false); });
  };
  if (S.dirty) save(true).then(go).catch(function () {}); else go();
};

/* ---------------- PDF ---------------- */
var libPromise;
function loadLib() {
  if (window.html2pdf) return Promise.resolve();
  libPromise = libPromise || new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'vendor/html2pdf.bundle.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return libPromise;
}
function makePdf(html, filename, footerText) {
  return loadLib().then(function () {
    var host = $('#pdfHost'), sy = window.scrollY; host.innerHTML = html; window.scrollTo(0, 0);
    var imgs = $$('img', host).map(function (im) { return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; }); });
    return Promise.all(imgs).then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      return window.html2pdf().set({
        margin: [10, 10, 14, 10], filename: filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid', 'tr', '.sig'] }
      }).from(host.querySelector('.pdoc')).toPdf().get('pdf').then(function (pdf) {
        var n = pdf.internal.getNumberOfPages();
        for (var i = 1; i <= n; i++) {
          pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(140, 128, 118);
          pdf.text(footerText, 10, 291); pdf.text('Page ' + i + ' of ' + n, 200, 291, { align: 'right' });
        }
        return pdf.output('blob');
      });
    }).then(function (blob) { host.innerHTML = ''; window.scrollTo(0, sy); return new File([blob], filename, { type: 'application/pdf' }); },
      function (err) { host.innerHTML = ''; window.scrollTo(0, sy); throw err; });
  });
}

var PDF_CSS = '<style>' +
  '.pdoc{width:718px;font-family:Manrope,Arial,sans-serif;color:#1E1A17;font-size:12.5px;line-height:1.5;background:#fff}' +
  '.pdoc h1{font:600 24px "Cormorant Garamond",Georgia,serif;color:#8B1230;margin:16px 0 2px;text-align:center;letter-spacing:.02em}' +
  '.pdoc .tag{text-align:center;color:#B8893E;font-style:italic;margin:0 0 14px}' +
  '.pdoc .band{background:#8B1230;border-radius:12px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;color:#F3E3C0}' +
  '.pdoc .band img{height:84px}' +
  '.pdoc .band .meta{text-align:right;font-size:11.5px;line-height:1.7}.pdoc .band .meta b{display:block;font:600 22px "Cormorant Garamond",Georgia,serif;color:#fff;letter-spacing:.06em}' +
  '.pdoc .two{display:flex;gap:16px;background:#F7F2EA;border-radius:10px;padding:14px 18px;margin:12px 0 4px}' +
  '.pdoc .two>div{flex:1}.pdoc .two .r{text-align:right}' +
  '.pdoc .lbl{font:700 9.5px Manrope,Arial;letter-spacing:.14em;text-transform:uppercase;color:#7A6F64;margin:0 0 3px}' +
  '.pdoc .big{font:600 17px "Cormorant Garamond",Georgia,serif;color:#8B1230;margin:0}' +
  '.pdoc h2{font:700 12px Manrope,Arial;letter-spacing:.12em;text-transform:uppercase;color:#8B1230;margin:15px 0 7px;padding-bottom:5px;border-bottom:1.5px solid #E2C27A}' +
  '.pdoc h3{font:700 11px Manrope,Arial;color:#8B1230;margin:10px 0 4px;letter-spacing:.06em;text-transform:uppercase}' +
  '.pdoc table{width:100%;border-collapse:collapse}' +
  '.pdoc th{background:#8B1230;color:#fff;font:700 10.5px Manrope,Arial;text-align:left;padding:8px 10px;letter-spacing:.04em}' +
  '.pdoc td{padding:6px 10px;border-bottom:1px solid #EFE6D8;vertical-align:top}' +
  '.pdoc .num{text-align:right;white-space:nowrap}' +
  '.pdoc tr.tot td{background:#F7F2EA;font-weight:700;color:#8B1230;font-size:14px;border-bottom:0}' +
  '.pdoc tr.sub td{font-weight:700}.pdoc tr.disc td{color:#1F7A4D}' +
  '.pdoc ul{margin:2px 0 6px;padding-left:18px}.pdoc li{margin:2px 0}' +
  '.pdoc .cols{display:flex;gap:18px}.pdoc .cols>div{flex:1}' +
  '.pdoc ol{margin:4px 0;padding-left:18px}.pdoc ol li{margin:3px 0;font-size:11.5px}' +
  '.pdoc .note{background:#FFF9EE;border-left:3px solid #B8893E;padding:8px 12px;border-radius:6px;margin:10px 0}' +
  '.pdoc .sigs{display:flex;gap:40px;margin-top:10px}.pdoc .sig{flex:1}.pdoc .sig .line{border-bottom:1px solid #1E1A17;height:40px;margin-bottom:6px}' +
  '.pdoc .foot{text-align:center;margin-top:16px;padding-top:10px;border-top:1px solid #EFE6D8;font-size:11px;color:#4A423B}' +
  '.pdoc .foot b{color:#8B1230;display:block;font-size:12px;letter-spacing:.08em}' +
  '.pdoc .muted{color:#7A6F64}.pdoc .avoid{page-break-inside:avoid;break-inside:avoid}' +
  '.pdoc .amtbox{background:#F7F2EA;border:1.5px solid #E2C27A;border-radius:12px;padding:16px 20px;text-align:center;margin:14px 0}' +
  '.pdoc .amtbox b{display:block;font:600 34px "Cormorant Garamond",Georgia,serif;color:#8B1230}' +
  '.pdoc .stamp{display:inline-block;border:2px solid #1F7A4D;color:#1F7A4D;border-radius:8px;padding:4px 12px;font:700 12px Manrope,Arial;letter-spacing:.14em;transform:rotate(-4deg)}' +
  '</style>';
function band(title, metaRows) {
  return '<div class="band avoid"><img src="../assets/img/logo.png" alt=""><div class="meta"><b>' + esc(title) + '</b>' + metaRows.map(function (r) { return esc(r[0]) + ': <strong>' + esc(r[1]) + '</strong>'; }).join('<br>') + '</div></div>';
}
function footerBlock() {
  return '<div class="foot avoid"><b>THE UNPOSED STORY</b>Candid Photography • Cinematic Videography • Traditional Documentation<br><span class="muted">' + esc(BRAND.areas) + '</span><br>' +
    esc(BRAND.phone) + ' · ' + esc(BRAND.email) + ' · Instagram ' + esc(BRAND.insta) + ' · ' + esc(BRAND.web) + '</div>';
}

function quoteHtml(q) {
  var t = compute(q), c = q.client;
  var evs = q.events.filter(function (e) { return e.on && e.name; });
  var team = TEAM.filter(function (r) { return num(q.team[r[0]]) > 0; }).map(function (r) {
    return '<li><b>' + esc(r[1].replace(/s$/, num(q.team[r[0]]) > 1 ? 's' : '')) + ': ' + num(q.team[r[0]]) + '</b> — ' + esc(r[2]) + '</li>';
  });
  if (q.team.drone && q.team.drone !== 'No') team.push('<li><b>Drone / aerial cinematography: ' + esc(q.team.drone) + '</b> — Aerial footage of the venue, grand entries and outdoor moments.</li>');
  var dl = function (kind) {
    return DELIV.filter(function (r) { return r[2] === kind && q.deliv[r[0]]; }).map(function (r) {
      var v = q.deliv[r[0]]; return '<li>' + esc(r[1]) + (typeof v === 'string' && v ? ' — <b>' + esc(v) + '</b>' : '') + '</li>';
    }).join('');
  };
  var dp = dl('photo'), dv = dl('video');
  var pk = q.pkg !== 'Custom' ? priceOf(q.pkg) : null;
  var contact = [c.phone, c.email].filter(Boolean).join(' · ');
  return PDF_CSS + '<div class="pdoc">' +
    band('QUOTATION', [['Quote no', q.no || 'Draft'], ['Date', fmtDate(q.quoteDate)], ['Valid until', fmtDate(t.validUntil)]]) +
    '<h1>Wedding Photography &amp; Videography Quotation</h1><p class="tag">The Unposed Story &nbsp;|&nbsp; ' + esc(BRAND.tagline) + '</p>' +
    '<div class="two avoid"><div><p class="lbl">Quotation prepared for</p><p class="big">' + esc(c.name) + (c.partner ? ' &amp; ' + esc(c.partner) : '') + '</p>' +
      (contact ? '<div class="muted">' + esc(contact) + '</div>' : '') + (c.venue ? '<div class="muted">' + esc(c.venue) + '</div>' : '') + (c.guests ? '<div class="muted">Guests: ' + esc(c.guests) + '</div>' : '') + '</div>' +
      '<div class="r"><p class="lbl">Service provider</p><p class="big">THE UNPOSED STORY</p><div class="muted"><i>Founded by ' + esc(BRAND.owner) + '</i></div><div class="muted">' + esc(BRAND.phone) + '</div><div class="muted">' + esc(BRAND.email) + '</div></div></div>' +
    (evs.length ? '<h2>Event details &amp; schedule</h2><table class="avoid"><tr><th>Event</th><th>Date</th><th>Venue / location</th><th>Timing</th></tr>' +
      evs.map(function (e) { return '<tr><td><b>' + esc(e.name) + '</b></td><td>' + esc(fmtDate(e.date) || 'To be finalised') + '</td><td>' + esc(e.venue || c.venue || 'To be finalised') + '</td><td>' + esc(e.timing || 'To be finalised') + '</td></tr>'; }).join('') + '</table>' : '') +
    (team.length ? '<div class="avoid"><h2>Team deployment &amp; coverage scope</h2><ul>' + team.join('') + '</ul></div>' : '') +
    (dp || dv ? '<div class="avoid"><h2>Deliverables</h2><div class="cols">' + (dp ? '<div><h3>Photography</h3><ul>' + dp + '</ul></div>' : '') + (dv ? '<div><h3>Cinematic videography</h3><ul>' + dv + '</ul></div>' : '') + '</div>' +
      (q.delivMode ? '<p style="margin:6px 0 0"><b>Delivery mode:</b> ' + esc(q.delivMode) + '</p>' : '') + '</div>' : '') +
    '<div class="avoid"><h2>Investment</h2><table><tr><th>Description</th><th class="num">Amount (INR)</th></tr>' +
      t.lines.map(function (l) {
        var extra = l.kind === 'pkg' && pk && pk.inclusions.length ? '<div class="muted" style="font-size:11px">' + esc(pk.inclusions.join(' · ')) + '</div>' : '';
        return '<tr><td>' + esc(l.label) + extra + '</td><td class="num">' + inr(l.amount) + '</td></tr>';
      }).join('') +
      (t.discount ? '<tr class="sub"><td>Subtotal</td><td class="num">' + inr(t.subtotal) + '</td></tr><tr class="disc"><td>Special discount</td><td class="num">−' + inr(t.discount) + '</td></tr>' : '') +
      '<tr class="tot"><td>TOTAL INVESTMENT</td><td class="num">' + inr(t.final) + '</td></tr></table>' +
      '<p class="muted" style="margin:6px 0 0;font-size:11px">Amount in words: Rupees ' + esc(words(t.final)) + ' Only</p></div>' +
    '<div class="avoid"><h2>Payment schedule</h2><table><tr><th>Payment milestone</th><th>Share</th><th class="num">Amount (INR)</th></tr>' +
      t.milestones.map(function (m) { return '<tr><td>' + esc(m.label) + '</td><td>' + m.pct + '%</td><td class="num">' + inr(m.amount) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="2">TOTAL</td><td class="num">' + inr(t.final) + '</td></tr></table></div>' +
    (q.notes ? '<div class="note avoid">' + esc(q.notes).replace(/\n/g, '<br>') + '</div>' : '') +
    '<div class="avoid"><h2>Terms &amp; conditions</h2><ol>' + q.terms.filter(Boolean).map(function (x) {
      var m = String(x).match(/^([^:]{3,40}):\s*(.*)$/); return '<li>' + (m ? '<b>' + esc(m[1]) + ':</b> ' + esc(m[2]) : esc(x)) + '</li>';
    }).join('') + '<li><b>Validity:</b> This quotation is valid until ' + esc(fmtDate(t.validUntil, true)) + '.</li></ol></div>' +
    '<div class="avoid"><h2>Client acceptance &amp; confirmation</h2><p class="muted" style="margin:0"><i>By signing below and paying the booking advance, the client confirms agreement with the terms, deliverables and schedule in this quotation.</i></p>' +
      '<div class="sigs"><div class="sig"><p class="lbl">For The Unposed Story</p><div class="line"></div><b>' + esc(BRAND.owner) + '</b><div class="muted">Founder &amp; Lead Photographer</div><div class="muted">Date: ____________</div></div>' +
      '<div class="sig"><p class="lbl">Client acceptance</p><div class="line"></div><b>' + esc(c.name) + '</b><div class="muted">Client signature</div><div class="muted">Date: ____________</div></div></div>' +
    footerBlock() + '</div></div>';
}

function receiptHtml(q, p) {
  var t = compute(q), c = q.client;
  var valid = (q.payments || []).filter(function (x) { return x.status !== 'Void'; });
  var upto = valid.filter(function (x) { return x.receiptNo <= p.receiptNo; }).reduce(function (s, x) { return s + num(x.amount); }, 0);
  var bal = t.final - upto;
  var nextM = (function () { var acc = 0; for (var i = 0; i < t.milestones.length; i++) { acc += t.milestones[i].amount; if (upto < acc) return t.milestones[i]; } return null; })();
  return PDF_CSS + '<div class="pdoc">' +
    band('PAYMENT RECEIPT', [['Receipt no', p.receiptNo], ['Date', fmtDate(p.date)], ['Quote no', q.no]]) +
    '<div class="two avoid" style="margin-top:16px"><div><p class="lbl">Received with thanks from</p><p class="big">' + esc(c.name) + (c.partner ? ' &amp; ' + esc(c.partner) : '') + '</p>' +
      '<div class="muted">' + esc([c.phone, c.email].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="r"><p class="lbl">Wedding</p><p class="big">' + esc(fmtDate(c.date, true) || 'Date to be finalised') + '</p><div class="muted">' + esc(c.venue || '') + '</div></div></div>' +
    '<div class="amtbox avoid"><p class="lbl">Amount received</p><b>' + inr(p.amount) + '</b><div>Rupees ' + esc(words(p.amount)) + ' Only</div></div>' +
    '<table class="avoid"><tr><th>Payment details</th><th></th></tr>' +
      '<tr><td>Towards</td><td class="num">' + esc(p.milestone) + '</td></tr>' +
      '<tr><td>Payment mode</td><td class="num">' + esc(p.mode) + '</td></tr>' +
      (p.txn ? '<tr><td>Transaction / cheque reference</td><td class="num">' + esc(p.txn) + '</td></tr>' : '') +
      (p.note ? '<tr><td>Note</td><td class="num">' + esc(p.note) + '</td></tr>' : '') +
    '</table>' +
    '<h2>Account summary</h2><table class="avoid"><tr><th>Description</th><th class="num">Amount (INR)</th></tr>' +
      '<tr><td>Total package value (' + esc(q.no) + ')</td><td class="num">' + inr(t.final) + '</td></tr>' +
      '<tr><td>Total received to date (including this receipt)</td><td class="num">' + inr(upto) + '</td></tr>' +
      '<tr class="tot"><td>BALANCE DUE</td><td class="num">' + inr(bal) + '</td></tr></table>' +
    (bal > 0 && nextM ? '<div class="note avoid">Next payment: <b>' + esc(nextM.label) + '</b> (' + nextM.pct + '% of total). Thank you for trusting us with your story.</div>' :
      '<div class="note avoid"><span class="stamp">PAID IN FULL</span>&nbsp; Thank you! Your account is fully settled.</div>') +
    '<div class="sigs avoid" style="margin-top:22px"><div class="sig"><p class="lbl">For The Unposed Story</p><div class="line"></div><b>' + esc(BRAND.owner) + '</b><div class="muted">Founder &amp; Lead Photographer</div></div>' +
      '<div class="sig" style="align-self:flex-end"><p class="muted" style="font-size:10.5px">This is a computer-generated receipt for payment received against quotation ' + esc(q.no) + '. It is not a tax invoice.</p></div></div>' +
    footerBlock() + '</div>';
}

/* ---------------- PDF preview → download / share ----------------
 * Every quotation or receipt is shown as the real PDF (rendered with pdf.js)
 * before it is downloaded or shared. The Share tap inside the preview is a fresh
 * user gesture, so phone share sheets open reliably. */
var PV = { file: null, text: '', phone: '', q: null, kind: '', editNo: null };
var pdfjsPromise;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  pdfjsPromise = pdfjsPromise || new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = 'vendor/pdfjs/pdf.min.js';
    s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; res(); };
    s.onerror = rej; document.head.appendChild(s);
  });
  return pdfjsPromise;
}
function renderPdf(file) {
  var host = $('#pvPages'); host.innerHTML = '';
  return loadPdfJs().then(function () { return file.arrayBuffer(); })
    .then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; })
    .then(function (doc) {
      var w = Math.min($('#pvScroll').clientWidth - 24, 860), dpr = Math.min(window.devicePixelRatio || 1, 2.5), chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n); }).then(function (page) {
          var base = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: w / base.width * dpr });
          var c = document.createElement('canvas'); c.className = 'pv-canvas';
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          c.style.width = w + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px';
          c.setAttribute('aria-label', 'Page ' + n + ' of ' + doc.numPages);
          host.appendChild(c);
          return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        });
      })(i);
      return chain.then(function () { return doc.numPages; });
    });
}
function showPdf(file, o) {
  PV = Object.assign({ file: file }, o);
  $('#pvTitle').textContent = o.title; $('#pvSub').textContent = o.sub || '';
  $('#pvEdit').hidden = !o.editNo;
  $('#pvShare').textContent = o.kind === 'receipt' ? 'Share receipt on WhatsApp' : 'Share on WhatsApp';
  $('#preview').hidden = false; document.body.style.overflow = 'hidden'; $('#pvScroll').scrollTop = 0;
  busy(true, 'Opening PDF preview…');
  renderPdf(file).then(function (n) {
    busy(false); $('#pvSub').textContent = (o.sub ? o.sub + ' · ' : '') + n + ' page' + (n > 1 ? 's' : '') + ' · ' + file.name;
    $('#pvShare').focus();
  }).catch(function (e) {
    busy(false); console.error(e);
    $('#pvPages').innerHTML = '<div class="pv-fallback">Preview isn’t available on this device, but your PDF is ready. Use <b>Download PDF</b> or <b>Share</b> above.</div>';
  });
}
function closePreview() { $('#preview').hidden = true; document.body.style.overflow = ''; $('#pvPages').innerHTML = ''; }
$('#pvClose').onclick = closePreview;
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#preview').hidden) closePreview(); });
$('#pvEdit').onclick = function () { var no = PV.editNo; closePreview(); if (no) location.hash = 'q/' + encodeURIComponent(no); };
$('#pvPdf').onclick = function () { download(PV.file); toast('Downloaded ' + PV.file.name); };
$('#pvShare').onclick = function () {
  var f = PV.file, k = PV;
  var markSent = function () {
    if (k.kind === 'quote' && k.q && k.q.status === 'Draft') {
      k.q.status = 'Sent'; if (k.q === S.q) $('#qStatus').value = 'Sent';
      api('setStatus', { id: k.q.no, status: 'Sent' }).then(refreshData).catch(function () {});
    }
  };
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    navigator.share({ files: [f], text: k.text, title: f.name }).then(function () { markSent(); closePreview(); toast('Shared'); }).catch(function () {});
  } else {
    download(f);
    window.open('https://wa.me/' + (waNum(k.phone) || '') + '?text=' + encodeURIComponent(k.text + '\n\n(PDF attached)'), '_blank', 'noopener');
    markSent();
    toast('PDF downloaded. Attach it in the WhatsApp chat that just opened.', 5000);
  }
};
function download(file) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function safeName(s) { return String(s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-'); }

/* Build the quotation PDF and show it. qOther = a saved quote opened from the dashboard. */
function quotePdf(qOther) {
  if (!qOther && !validate()) return;
  var p = qOther ? Promise.resolve() : (S.dirty || !S.q.no ? save(true) : Promise.resolve());
  p.then(function () {
    busy(true, 'Creating your quotation PDF…');
    var q = qOther || S.q, t = compute(q), first = String(q.client.name).split(/[ &]/)[0];
    return makePdf(quoteHtml(q), 'Quotation-' + q.no + '-' + safeName(q.client.name) + '.pdf', 'The Unposed Story · Quotation ' + q.no + ' · ' + BRAND.phone).then(function (file) {
      busy(false);
      var text = 'Hi ' + first + ', thank you for considering The Unposed Story for your wedding! 💛\n\nPlease find your quotation ' + q.no + ' attached.\nTotal investment: ' + inr(t.final) +
        '\nValid until: ' + fmtDate(t.validUntil, true) + '\n\nHappy to answer any questions or walk you through it on a call.\n— Sandip Lade, The Unposed Story';
      showPdf(file, { kind: 'quote', q: q, text: text, phone: q.client.phone, editNo: qOther ? q.no : null,
        title: 'Quotation ' + q.no + ' · ' + q.client.name, sub: inr(t.final) + ' · ' + q.status });
    });
  }).catch(function (e) { busy(false); if (e && e.message !== 'invalid' && e.message !== 'save') { console.error(e); toast('Could not create the PDF. Please try again.'); } });
}
$('#pvBtn').onclick = function () { quotePdf(); };
$('#shareBtn').onclick = function () { quotePdf(); };

function previewSaved(no) {
  busy(true, 'Loading ' + no + '…');
  api('getQuote', { id: no }).then(function (r) {
    busy(false); if (!r.ok) return toast(r.error || 'Not found');
    var q = Object.assign(blankQuote(), r.quote); q.no = no; q.status = r.quote.status || 'Draft';
    quotePdf(q);
  }).catch(function () { busy(false); });
}

function receiptPdf(receiptNo, qOther) {
  var q = qOther || S.q, p = (q.payments || []).filter(function (x) { return x.receiptNo === receiptNo; })[0];
  if (!p) return;
  busy(true, 'Creating receipt ' + receiptNo + '…');
  makePdf(receiptHtml(q, p), 'Receipt-' + receiptNo + '-' + safeName(q.client.name) + '.pdf', 'The Unposed Story · Receipt ' + receiptNo + ' · ' + BRAND.phone).then(function (file) {
    busy(false);
    var first = String(q.client.name).split(/[ &]/)[0], t = compute(q);
    var upto = (q.payments || []).filter(function (x) { return x.status !== 'Void' && x.receiptNo <= receiptNo; }).reduce(function (s, x) { return s + num(x.amount); }, 0);
    var text = 'Hi ' + first + ', thank you! We have received ' + inr(p.amount) + ' (' + p.mode + ') towards ' + p.milestone + '.\n\nReceipt ' + receiptNo + ' is attached.\nTotal received: ' + inr(upto) +
      ' · Balance: ' + inr(t.final - upto) + '\n\n— Sandip Lade, The Unposed Story';
    showPdf(file, { kind: 'receipt', q: q, text: text, phone: q.client.phone, title: 'Receipt ' + receiptNo + ' · ' + q.client.name, sub: inr(p.amount) + ' · ' + fmtDate(p.date) + ' · ' + p.mode });
  }).catch(function (e) { busy(false); console.error(e); toast('Could not create the receipt PDF.'); });
}

/* ---------------- demo backend (for ?demo=1 previews) ---------------- */
var Demo = (function () {
  var prices = [
    { type: 'Package', name: 'Essential', inclusions: ['6 hours coverage', '1 candid + 1 traditional photographer', '150–200 edited photos', 'Online gallery'], price: 35000, cost: 13000, costConfirmed: false },
    { type: 'Package', name: 'Silver', inclusions: ['8 hours coverage', '2 photographers + 1 videographer', '250–300 edited photos', 'Highlights reel', 'Online gallery'], price: 55000, cost: 26000, costConfirmed: false },
    { type: 'Package', name: 'Gold', inclusions: ['10 hours coverage', '2 photographers + 2 cinematographers', '400–500 edited photos', 'Cinematic wedding film', 'Drone aerial coverage', '30-page premium album'], price: 85000, cost: 52000, costConfirmed: false },
    { type: 'Package', name: 'Platinum', inclusions: ['12–14 hours full coverage', '2 photographers + 2 videographers', '600–700 edited photos', 'Cinematic wedding film', 'Pre-wedding shoot included', '40-page luxury album'], price: 135000, cost: 82000, costConfirmed: false },
    { type: 'Add-on', name: 'Drone coverage', inclusions: ['Aerial photos and video'], price: 5000, cost: 3000 },
    { type: 'Add-on', name: 'Instagram reel', inclusions: ['Short vertical edit'], price: 3000, cost: 1200 },
    { type: 'Add-on', name: 'Extra album', inclusions: ['Additional printed album'], price: 8000, cost: 5000 },
    { type: 'Add-on', name: 'Makeup artist', inclusions: ['Professional makeup'], price: 6000, cost: 4500 },
    { type: 'Add-on', name: 'Costume styling', inclusions: ['Outfit styling and props'], price: 5000, cost: 3500 },
    { type: 'Add-on', name: 'Extra location', inclusions: ['One additional location'], price: 3000, cost: 1500 },
    { type: 'Add-on', name: 'Luxury album', inclusions: ['Premium album upgrade'], price: 10000, cost: 7000 }
  ];
  var enquiries = [
    { ref: 'TUS-482913', status: 'New', name: 'Priya Sharma', partner: 'Rohan Mehta', phone: '+91 98200 12345', email: 'priya@example.com', date: '2027-02-14', location: 'Thane, The Lalit', package: 'Gold', guests: '200–500', message: 'Haldi, sangeet and wedding over 3 days.' },
    { ref: 'TUS-377120', status: 'Contacted', name: 'Sneha Patil', partner: 'Amit Joshi', phone: '9867012345', email: '', date: '2026-12-20', location: 'Pune', package: 'Silver', guests: '100–200', message: '' }
  ];
  var store = {}, seq = 0, rseq = 0;
  function summary(q) { var t = q.totals || {}; var paid = (q.payments || []).filter(function (p) { return p.status !== 'Void'; }).reduce(function (s, p) { return s + p.amount; }, 0);
    return { no: q.no, created: q._created, status: q.status, ref: q.ref, client: q.client.name, partner: q.client.partner, phone: q.client.phone, date: q.client.date, venue: q.client.venue, budget: num(q.budget), final: t.final, cost: t.cost, profit: t.profit, margin: t.margin, paid: paid, balance: t.final - paid }; }
  function call(a, d) {
    if (a === 'login') return { ok: true, token: 'demo' };
    if (a === 'bootstrap') return { ok: true, prices: prices, enquiries: enquiries, quotes: Object.keys(store).map(function (k) { return summary(store[k]); }).reverse(), sheetUrl: '' };
    if (a === 'saveQuote') { var q = clone(d.quote); if (!q.no) { q.no = 'Q-2026-' + ('00' + (++seq)).slice(-3); q._created = new Date().toISOString(); q.payments = []; } else { q.payments = store[q.no].payments; q._created = store[q.no]._created; } store[q.no] = q; return { ok: true, no: q.no, payments: q.payments }; }
    if (a === 'getQuote') return store[d.id] ? { ok: true, quote: clone(store[d.id]) } : { ok: false, error: 'Not found' };
    if (a === 'setStatus') { if (store[d.id]) store[d.id].status = d.status; return { ok: true }; }
    if (a === 'addPayment') { var s = store[d.id]; var p = Object.assign({ receiptNo: 'R-2026-' + ('00' + (++rseq)).slice(-3), status: 'Valid' }, d.payment); p.amount = num(p.amount); s.payments.push(p); if (['Draft', 'Sent', 'Negotiating'].indexOf(s.status) >= 0) s.status = 'Accepted'; return { ok: true, payment: p, payments: clone(s.payments), status: s.status }; }
    if (a === 'voidPayment') { var s2 = store[d.id]; s2.payments.forEach(function (p) { if (p.receiptNo === d.receiptNo) p.status = 'Void'; }); return { ok: true, payments: clone(s2.payments) }; }
    return { ok: false, error: 'demo' };
  }
  return { call: call };
})();

/* ---------------- boot ---------------- */
if (DEMO) { S.token = 'demo'; document.title = 'DEMO · ' + document.title; start(); }
else {
  try { S.token = sessionStorage.getItem('tus_tok'); } catch (e) {}
  if (S.token) start(); else lock();
}
})();
