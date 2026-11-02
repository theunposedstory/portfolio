/**
 * The Unposed Story — Enquiries + Quotation Builder backend
 * Google Sheet + Apps Script web app (owner: weddings.theunposedstory@gmail.com)
 *
 * 1) Website enquiries  -> "Enquiries" tab + instant email   (no "action" field)
 * 2) Quotation builder  -> "Quotations", "Price list", "Payments" tabs (action: login,
 *                          bootstrap, saveQuote, getQuote, setStatus, changePin,
 *                          addPayment, voidPayment)
 *
 * After pasting a new version: Deploy > Manage deployments > edit (pencil) >
 * Version: New version > Deploy. The web app URL stays the same.
 */

var NOTIFY_EMAIL = 'weddings.theunposedstory@gmail.com';
var SHEET_NAME   = 'Enquiries';
var QUOTE_SHEET  = 'Quotations';
var PRICE_SHEET  = 'Price list';
var TIMEZONE     = 'Asia/Kolkata';

var HEADERS = ['Received (IST)', 'Ref', 'Status', 'Name', 'Partner', 'WhatsApp', 'Email',
               'Wedding date', 'City / venue', 'Collection', 'Guests', 'About the wedding',
               'Source', 'Chat on WhatsApp'];
var STATUSES = ['New', 'Contacted', 'Call booked', 'Quote sent', 'Booked', 'Lost'];

var QUOTE_HEADERS = ['Quote no', 'Created', 'Updated', 'Status', 'Enquiry ref', 'Client', 'Partner',
  'WhatsApp', 'Email', 'Wedding date', 'Venue / city', 'Events', 'Client budget', 'Quoted (before discount)',
  'Discount', 'Final amount', 'Budget gap', 'Payment plan', 'Internal cost', 'Profit', 'Margin %',
  'Paid to date', 'Balance due', 'Valid until', 'Notes', 'Data (do not edit)'];
var PAY_SHEET = 'Payments';
var PAY_HEADERS = ['Receipt no', 'Payment date', 'Quote no', 'Client', 'Milestone', 'Amount (₹)', 'Mode',
  'Transaction / cheque ref', 'Note', 'Recorded at', 'Status'];
function qc_(name) { return QUOTE_HEADERS.indexOf(name); }   // 0-based column index
var QUOTE_STATUSES = ['Draft', 'Sent', 'Negotiating', 'Accepted', 'Lost'];

var PRICE_HEADERS = ['Type', 'Item', 'Inclusions (one per line)', 'Client price (₹)', 'Internal cost (₹)', 'Cost confirmed?', 'Active?'];
var DEFAULT_PRICES = [
  ['Package', 'Essential', '6 hours coverage\n1 candid + 1 traditional photographer\n150–200 edited photos\nOnline gallery', 35000, 13000, 'No', 'Yes'],
  ['Package', 'Silver', '8 hours coverage\n2 photographers + 1 videographer\n250–300 edited photos\nHighlights reel\nOnline gallery', 55000, 26000, 'No', 'Yes'],
  ['Package', 'Gold', '10 hours coverage\n2 photographers + 2 cinematographers\n400–500 edited photos\nCinematic wedding film\nDrone aerial coverage\n30-page premium album', 85000, 52000, 'No', 'Yes'],
  ['Package', 'Platinum', '12–14 hours full coverage\n2 photographers + 2 videographers\n600–700 edited photos\nCinematic wedding film\nPre-wedding shoot included\n40-page luxury album', 135000, 82000, 'No', 'Yes'],
  ['Add-on', 'Drone coverage', 'Aerial photos and video', 5000, 3000, 'No', 'Yes'],
  ['Add-on', 'Instagram reel', 'Short vertical edit for social media', 3000, 1200, 'No', 'Yes'],
  ['Add-on', 'Extra album', 'Additional printed album', 8000, 5000, 'No', 'Yes'],
  ['Add-on', 'Makeup artist', 'Professional makeup for the shoot', 6000, 4500, 'No', 'Yes'],
  ['Add-on', 'Costume styling', 'Outfit styling and props', 5000, 3500, 'No', 'Yes'],
  ['Add-on', 'Extra location', 'One additional shoot location', 3000, 1500, 'No', 'Yes'],
  ['Add-on', 'Luxury album', 'Premium luxury album upgrade', 10000, 7000, 'No', 'Yes']
];

/* ======================= Web app entry points ======================= */

function doPost(e) {
  try {
    var d = parseBody_(e);
    if (d.action) return json_(handleAction_(d));
    return json_(handleEnquiry_(d));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'The Unposed Story enquiries + quotations' });
}

/* ======================= 1) Website enquiries ======================= */

function handleEnquiry_(d) {
  if (d.website) return { ok: true };                 // spam trap
  if (!d.name || !d.phone) return { ok: false, error: 'Missing name or phone' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var ref, phoneDigits;
  try {
    var sh = getSheet_();
    ref = clean_(d.ref, 20) || ('TUS-' + String(Date.now()).slice(-6));
    if (sh.getLastRow() > 1) {
      var refs = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) return { ok: true, ref: ref, duplicate: true };
    }
    phoneDigits = toWaNumber_(d.phone);
    sh.appendRow([
      new Date(), ref, 'New',
      clean_(d.name, 120), clean_(d.partner, 120), clean_(d.phone, 30), clean_(d.email, 120),
      clean_(d.date, 20), clean_(d.location, 200), clean_(d.package, 60), clean_(d.guests, 30),
      clean_(d.message, 3000), clean_(d.source, 80) || 'Website',
      phoneDigits ? '=HYPERLINK("https://wa.me/' + phoneDigits + '","Open chat")' : ''
    ]);
  } finally { lock.releaseLock(); }
  sendEmail_(d, ref, phoneDigits);
  return { ok: true, ref: ref };
}

function sendEmail_(d, ref, phoneDigits) {
  var first = String(d.name || '').split(' ')[0];
  var dateTxt = prettyDate_(d.date);
  var waText = encodeURIComponent('Hi ' + first + ', this is Sandip from The Unposed Story. Thank you for your enquiry for ' + (dateTxt || 'your wedding') + '!');
  var waLink = phoneDigits ? 'https://wa.me/' + phoneDigits + '?text=' + waText : '';
  var rows = [
    ['Name', d.name], ['Partner', d.partner], ['WhatsApp', d.phone], ['Email', d.email],
    ['Wedding date', dateTxt], ['City / venue', d.location], ['Collection', d.package || 'Not sure yet'],
    ['Guests', d.guests], ['About the wedding', d.message]
  ].filter(function (r) { return r[1]; });
  var table = rows.map(function (r) {
    return '<tr><td style="padding:8px 14px 8px 0;color:#7A6F64;font:600 12px Arial;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;white-space:nowrap">' + r[0] +
           '</td><td style="padding:8px 0;font:15px Arial;color:#1E1A17">' + esc_(r[1]).replace(/\n/g, '<br>') + '</td></tr>';
  }).join('');
  var html =
    '<div style="max-width:560px;margin:auto;border:1px solid #E2D6C3;border-radius:14px;overflow:hidden">' +
      '<div style="background:#8B1230;color:#F3E3C0;padding:18px 24px;font:600 13px Arial;letter-spacing:.14em;text-transform:uppercase">New wedding enquiry · ' + esc_(ref) + '</div>' +
      '<div style="padding:22px 24px;background:#FBF8F3"><table style="border-collapse:collapse;width:100%">' + table + '</table>' +
        (waLink ? '<p style="margin:22px 0 6px"><a href="' + waLink + '" style="display:inline-block;background:#1F7A4D;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font:700 13px Arial;letter-spacing:.06em">Reply to ' + esc_(first) + ' on WhatsApp</a></p>' : '') +
        (d.phone ? '<p style="margin:10px 0 0;font:13px Arial;color:#7A6F64">Or call: <a href="tel:' + esc_(String(d.phone).replace(/\s/g, '')) + '">' + esc_(d.phone) + '</a></p>' : '') +
      '</div>' +
      '<div style="padding:12px 24px;background:#EFE6D8;font:12px Arial;color:#7A6F64">Saved to your "Enquiries" sheet · <a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Open sheet</a></div>' +
    '</div>';
  var plain = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + (waLink ? '\n\nReply on WhatsApp: ' + waLink : '');
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: d.email && /@/.test(d.email) ? d.email : NOTIFY_EMAIL,
    subject: 'New enquiry: ' + (d.name || '') + (dateTxt ? ' · ' + dateTxt : '') + ' · ' + (d.package || 'Not sure yet'),
    body: plain, htmlBody: html, name: 'The Unposed Story Website'
  });
}

/* ======================= 2) Quotation builder ======================= */

function handleAction_(d) {
  switch (d.action) {
    case 'login':     return login_(d);
    case 'bootstrap': auth_(d); return bootstrap_();
    case 'saveQuote': auth_(d); return saveQuote_(d.quote || {});
    case 'getQuote':  auth_(d); return getQuote_(d.id);
    case 'setStatus': auth_(d); return setStatus_(d.id, d.status);
    case 'changePin': auth_(d); return changePin_(d.newPin);
    case 'addPayment':  auth_(d); return addPayment_(d.id, d.payment || {});
    case 'voidPayment': auth_(d); return voidPayment_(d.id, d.receiptNo);
    default: return { ok: false, error: 'Unknown action' };
  }
}

/* --- PIN login: the first PIN ever entered (6+ digits) becomes your PIN --- */
function login_(d) {
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pin_fails') || 0);
  if (fails >= 8) return { ok: false, error: 'Too many wrong PINs. Try again in 15 minutes.' };
  var pin = String(d.pin || '').trim();
  if (!/^\d{6,10}$/.test(pin)) return { ok: false, error: 'PIN must be 6–10 digits.' };
  var saved = props.getProperty('QUOTE_PIN_HASH');
  var created = false;
  if (!saved) { props.setProperty('QUOTE_PIN_HASH', hash_(pin)); created = true; }
  else if (saved !== hash_(pin)) { cache.put('pin_fails', String(fails + 1), 900); return { ok: false, error: 'Wrong PIN.' }; }
  cache.remove('pin_fails');
  var token = Utilities.getUuid();
  cache.put('tok_' + token, '1', 21600);              // 6-hour session
  return { ok: true, token: token, pinCreated: created };
}
function auth_(d) {
  if (!d.token || !CacheService.getScriptCache().get('tok_' + d.token)) throw new Error('SESSION_EXPIRED');
}
function changePin_(newPin) {
  newPin = String(newPin || '').trim();
  if (!/^\d{6,10}$/.test(newPin)) return { ok: false, error: 'PIN must be 6–10 digits.' };
  PropertiesService.getScriptProperties().setProperty('QUOTE_PIN_HASH', hash_(newPin));
  return { ok: true };
}
function hash_(s) {
  var salt = 'tus-quote-v1|';
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + s));
}

/* --- load everything the builder needs --- */
function bootstrap_() {
  var prices = getPriceSheet_().getDataRange().getValues().slice(1)
    .filter(function (r) { return r[1] && String(r[6]).toLowerCase() !== 'no'; })
    .map(function (r) {
      return { type: String(r[0]), name: String(r[1]), inclusions: String(r[2] || '').split('\n').filter(String),
               price: Number(r[3]) || 0, cost: Number(r[4]) || 0, costConfirmed: String(r[5]).toLowerCase() === 'yes' };
    });

  var enquiries = [];
  var es = getSheet_();
  if (es.getLastRow() > 1) {
    var ev = es.getRange(2, 1, es.getLastRow() - 1, 13).getValues();
    enquiries = ev.slice(-300).reverse().map(function (r) {
      return { received: iso_(r[0]), ref: r[1], status: r[2], name: r[3], partner: r[4], phone: String(r[5]).replace(/^'/, ''),
               email: r[6], date: dateStr_(r[7]), location: r[8], package: r[9], guests: r[10], message: r[11] };
    });
  }

  var qs = getQuoteSheet_(), quotes = [];
  if (qs.getLastRow() > 1) {
    var qv = qs.getRange(2, 1, qs.getLastRow() - 1, QUOTE_HEADERS.length).getValues();
    quotes = qv.map(function (r) {
      return { no: r[0], created: iso_(r[1]), updated: iso_(r[2]), status: r[3], ref: r[4], client: r[5], partner: r[6],
               phone: String(r[7]).replace(/^'/, ''), date: dateStr_(r[qc_('Wedding date')]), venue: r[qc_('Venue / city')],
               budget: Number(r[qc_('Client budget')]) || 0, final: Number(r[qc_('Final amount')]) || 0,
               cost: Number(r[qc_('Internal cost')]) || 0, profit: Number(r[qc_('Profit')]) || 0, margin: Number(r[qc_('Margin %')]) || 0,
               paid: Number(r[qc_('Paid to date')]) || 0, balance: Number(r[qc_('Balance due')]) || 0 };
    }).reverse();
  }
  return { ok: true, prices: prices, enquiries: enquiries, quotes: quotes, sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
}

/* --- save (create or update) a quote --- */
function saveQuote_(q) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = getQuoteSheet_();
    var now = new Date();
    var rowIndex = -1;
    if (q.no && sh.getLastRow() > 1) {
      var nos = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < nos.length; i++) if (nos[i][0] === q.no) { rowIndex = i + 2; break; }
    }
    var created = now;
    if (rowIndex === -1) {
      q.no = nextQuoteNo_(sh);
      q.payments = [];
    } else {
      created = sh.getRange(rowIndex, 2).getValue() || now;
      var old = {}; try { old = JSON.parse(sh.getRange(rowIndex, QUOTE_HEADERS.length).getValue()); } catch (x) {}
      q.payments = old.payments || [];          // payments are only changed via addPayment / voidPayment
    }
    q.status = QUOTE_STATUSES.indexOf(q.status) >= 0 ? q.status : 'Draft';
    var t = q.totals || {};
    var paid = paidTotal_(q);
    var row = [
      q.no, created, now, q.status, clean_(q.ref, 20), clean_(q.client && q.client.name, 120), clean_(q.client && q.client.partner, 120),
      clean_(q.client && q.client.phone, 30), clean_(q.client && q.client.email, 120), clean_(q.client && q.client.date, 20),
      clean_(q.client && q.client.venue, 200), clean_((q.events || []).join(', '), 300),
      num_(q.budget), num_(t.subtotal), num_(t.discount), num_(t.final), num_(t.gap), clean_(q.planLabel, 40),
      num_(t.cost), num_(t.profit), Math.round((Number(t.margin) || 0) * 10) / 10,
      paid, num_(t.final) - paid,
      clean_(q.validUntil, 20), clean_(q.notes, 2000), JSON.stringify(q).slice(0, 49000)
    ];
    if (rowIndex === -1) sh.appendRow(row);
    else sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    // keep the enquiry status in step
    if (q.ref && (q.status === 'Sent' || q.status === 'Accepted' || q.status === 'Lost')) {
      updateEnquiryStatus_(q.ref, q.status === 'Sent' ? 'Quote sent' : q.status === 'Accepted' ? 'Booked' : 'Lost');
    }
    return { ok: true, no: q.no, updated: iso_(now), payments: q.payments, paid: paid };
  } finally { lock.releaseLock(); }
}

/* --- payments & receipts --- */
function findQuoteRow_(sh, no) {
  if (sh.getLastRow() < 2) return -1;
  var nos = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < nos.length; i++) if (nos[i][0] === no) return i + 2;
  return -1;
}
function paidTotal_(q) {
  return (q.payments || []).filter(function (p) { return p.status !== 'Void'; })
    .reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
}
function writeQuoteMoney_(sh, row, q) {
  var paid = paidTotal_(q), fin = Number(q.totals && q.totals.final) || 0;
  sh.getRange(row, qc_('Paid to date') + 1, 1, 2).setValues([[paid, fin - paid]]);
  sh.getRange(row, QUOTE_HEADERS.length).setValue(JSON.stringify(q).slice(0, 49000));
  sh.getRange(row, 3).setValue(new Date());
  return { paid: paid, balance: fin - paid };
}
function addPayment_(no, p) {
  var amount = Math.round(Number(p.amount) || 0);
  if (amount <= 0) return { ok: false, error: 'Amount must be more than 0' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var qs = getQuoteSheet_(), row = findQuoteRow_(qs, no);
    if (row < 0) return { ok: false, error: 'Save the quote first' };
    var q = JSON.parse(qs.getRange(row, QUOTE_HEADERS.length).getValue() || '{}');
    q.no = no; q.payments = q.payments || [];
    var ps = getPaySheet_();
    var pay = {
      receiptNo: nextReceiptNo_(ps), date: clean_(p.date, 20) || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd'),
      amount: amount, milestone: clean_(p.milestone, 80), mode: clean_(p.mode, 30), txn: clean_(p.txn, 80),
      note: clean_(p.note, 300), recordedAt: new Date().toISOString(), status: 'Valid'
    };
    q.payments.push(pay);
    var status = qs.getRange(row, 4).getValue();
    if (status === 'Draft' || status === 'Sent' || status === 'Negotiating') {
      status = 'Accepted'; q.status = 'Accepted'; qs.getRange(row, 4).setValue('Accepted');
      updateEnquiryStatus_(qs.getRange(row, 5).getValue(), 'Booked');
    }
    var money = writeQuoteMoney_(qs, row, q);
    ps.appendRow([pay.receiptNo, pay.date, no, qs.getRange(row, 6).getValue(), pay.milestone, pay.amount, pay.mode, pay.txn, pay.note, new Date(), 'Valid']);
    return { ok: true, payment: pay, payments: q.payments, paid: money.paid, balance: money.balance, status: status };
  } finally { lock.releaseLock(); }
}
function voidPayment_(no, receiptNo) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var qs = getQuoteSheet_(), row = findQuoteRow_(qs, no);
    if (row < 0) return { ok: false, error: 'Quote not found' };
    var q = JSON.parse(qs.getRange(row, QUOTE_HEADERS.length).getValue() || '{}');
    var hit = (q.payments || []).filter(function (p) { return p.receiptNo === receiptNo; })[0];
    if (!hit) return { ok: false, error: 'Receipt not found' };
    hit.status = 'Void';
    var money = writeQuoteMoney_(qs, row, q);
    var ps = getPaySheet_();
    if (ps.getLastRow() > 1) {
      var r = ps.getRange(2, 1, ps.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < r.length; i++) if (r[i][0] === receiptNo) { ps.getRange(i + 2, 11).setValue('Void'); break; }
    }
    return { ok: true, payments: q.payments, paid: money.paid, balance: money.balance };
  } finally { lock.releaseLock(); }
}
function nextReceiptNo_(ps) {
  var year = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy'), max = 0;
  if (ps.getLastRow() > 1) ps.getRange(2, 1, ps.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var m = String(r[0]).match(/^R-(\d{4})-(\d+)$/); if (m && m[1] === year) max = Math.max(max, Number(m[2]));
  });
  return 'R-' + year + '-' + ('00' + (max + 1)).slice(-3);
}
function getPaySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PAY_SHEET) || ss.insertSheet(PAY_SHEET);
  if (sh.getLastRow() === 0) {
    headerRow_(sh, PAY_HEADERS, [100, 110, 100, 160, 200, 110, 110, 180, 220, 150, 80]);
    sh.getRange('F:F').setNumberFormat('₹#,##,##0');
    sh.getRange('J:J').setNumberFormat('dd mmm yyyy, h:mm am/pm');
    statusColours_(sh, 11, ['Valid', 'Void'], { 'Valid': '#CDEFD6', 'Void': '#F6D5D5' });
  }
  return sh;
}

function getQuote_(no) {
  var sh = getQuoteSheet_();
  if (sh.getLastRow() < 2) return { ok: false, error: 'Not found' };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, QUOTE_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === no) {
    var q = {}; try { q = JSON.parse(v[i][QUOTE_HEADERS.length - 1]); } catch (x) {}
    q.no = no; q.status = v[i][3];
    return { ok: true, quote: q };
  }
  return { ok: false, error: 'Not found' };
}

function setStatus_(no, status) {
  if (QUOTE_STATUSES.indexOf(status) < 0) return { ok: false, error: 'Bad status' };
  var sh = getQuoteSheet_();
  var v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 5).getValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === no) {
    sh.getRange(i + 2, 4).setValue(status);
    sh.getRange(i + 2, 3).setValue(new Date());
    if (v[i][4]) updateEnquiryStatus_(v[i][4], status === 'Sent' ? 'Quote sent' : status === 'Accepted' ? 'Booked' : status === 'Lost' ? 'Lost' : null);
    return { ok: true };
  }
  return { ok: false, error: 'Not found' };
}

function updateEnquiryStatus_(ref, status) {
  if (!ref || !status) return;
  var es = getSheet_();
  if (es.getLastRow() < 2) return;
  var refs = es.getRange(2, 2, es.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) { es.getRange(i + 2, 3).setValue(status); return; }
}

function nextQuoteNo_(sh) {
  var year = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy');
  var max = 0;
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var m = String(r[0]).match(/^Q-(\d{4})-(\d+)$/);
      if (m && m[1] === year) max = Math.max(max, Number(m[2]));
    });
  }
  return 'Q-' + year + '-' + ('00' + (max + 1)).slice(-3);
}

/* ======================= Sheet setup ======================= */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(SHEET_NAME) : ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    headerRow_(sh, HEADERS, [150, 95, 110, 150, 140, 140, 190, 110, 170, 120, 90, 320, 150, 110]);
    sh.getRange('A:A').setNumberFormat('dd mmm yyyy, h:mm am/pm');
    sh.getRange('L:L').setWrap(true);
    statusColours_(sh, 3, STATUSES, { 'New': '#FDE7C8', 'Contacted': '#DCEBFA', 'Call booked': '#E7DDF8', 'Quote sent': '#FFF3B8', 'Booked': '#CDEFD6', 'Lost': '#EEEEEE' });
    sh.getParent().setSpreadsheetTimeZone(TIMEZONE);
  }
  return sh;
}

function getQuoteSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(QUOTE_SHEET) || ss.insertSheet(QUOTE_SHEET);
  if (sh.getLastRow() === 0) {
    headerRow_(sh, QUOTE_HEADERS, [100, 140, 140, 110, 95, 150, 130, 130, 180, 105, 160, 200, 110, 120, 95, 115, 105, 110, 110, 100, 85, 110, 110, 100, 240, 80]);
    sh.getRange('B:C').setNumberFormat('dd mmm yyyy, h:mm am/pm');
    sh.getRange('M:Q').setNumberFormat('₹#,##,##0');
    sh.getRange('S:T').setNumberFormat('₹#,##,##0');
    sh.getRange('U:U').setNumberFormat('0.0"%"');
    sh.getRange('V:W').setNumberFormat('₹#,##,##0');
    sh.hideColumns(QUOTE_HEADERS.length);
    statusColours_(sh, 4, QUOTE_STATUSES, { 'Draft': '#EEEEEE', 'Sent': '#DCEBFA', 'Negotiating': '#FFF3B8', 'Accepted': '#CDEFD6', 'Lost': '#F6D5D5' });
  }
  return sh;
}

function getPriceSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PRICE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PRICE_SHEET);
    headerRow_(sh, PRICE_HEADERS, [90, 170, 320, 130, 130, 120, 80]);
    sh.getRange(2, 1, DEFAULT_PRICES.length, PRICE_HEADERS.length).setValues(DEFAULT_PRICES);
    sh.getRange('C:C').setWrap(true);
    sh.getRange('D:E').setNumberFormat('₹#,##,##0');
    sh.getRange(2, 5, DEFAULT_PRICES.length, 1).setBackground('#FFF3B8');
    sh.getRange(DEFAULT_PRICES.length + 3, 1).setValue('Yellow cells are SAMPLE cost estimates. Replace them with your real costs and set "Cost confirmed?" to Yes. Add rows for new items any time.').setFontStyle('italic').setFontColor('#7A6F64');
  }
  return sh;
}

function headerRow_(sh, headers, widths) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setFontColor('#F3E3C0').setBackground('#8B1230').setVerticalAlignment('middle');
  sh.setRowHeight(1, 34); sh.setFrozenRows(1);
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function statusColours_(sh, col, list, colours) {
  var range = sh.getRange(2, col, 1000, 1);
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build());
  sh.setConditionalFormatRules(Object.keys(colours).map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(colours[s]).setRanges([range]).build();
  }));
}

/** Run once from the editor: creates all tabs and sends a test enquiry email. */
function setupAndTest() {
  getSheet_(); getQuoteSheet_(); getPriceSheet_(); getPaySheet_();
  handleEnquiry_({ ref: 'TEST-' + String(Date.now()).slice(-4), name: 'Test Couple', partner: 'Partner', phone: '+91 70452 78377',
    email: NOTIFY_EMAIL, date: '2027-02-14', location: 'Mumbai', package: 'Gold', guests: '200–500',
    message: 'This is a test enquiry. You can delete this row.', source: 'Setup test' });
}

/** Run from the editor if you forget your quotation PIN (the next PIN you enter becomes the new one). */
function resetQuotePin() { PropertiesService.getScriptProperties().deleteProperty('QUOTE_PIN_HASH'); }

/* ======================= Helpers ======================= */

function parseBody_(e) {
  var d = {};
  if (e && e.postData && e.postData.contents) { try { d = JSON.parse(e.postData.contents); } catch (x) { d = {}; } }
  if (e && e.parameter) Object.keys(e.parameter).forEach(function (k) { if (d[k] === undefined) d[k] = e.parameter[k]; });
  return d;
}
function clean_(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max || 500);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function num_(v) { var n = Number(v); return isFinite(n) ? Math.round(n) : 0; }
function toWaNumber_(p) {
  var n = String(p || '').replace(/\D/g, '');
  if (n.length === 10) n = '91' + n;
  if (n.length === 11 && n.charAt(0) === '0') n = '91' + n.slice(1);
  return n.length >= 11 && n.length <= 15 ? n : '';
}
function prettyDate_(v) {
  if (!v) return '';
  var d = new Date(v + 'T00:00:00');
  return isNaN(d) ? String(v) : Utilities.formatDate(d, TIMEZONE, 'EEE, d MMM yyyy');
}
function dateStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd') : String(v || ''); }
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function esc_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
