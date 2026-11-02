/**
 * The Unposed Story — Website Enquiries
 * Google Sheet + Apps Script web app.
 *
 * What it does for every enquiry sent from the website form:
 *   1. Adds a row to the "Enquiries" tab (creates and formats the tab on first use)
 *   2. Emails NOTIFY_EMAIL instantly with all details + a one-tap WhatsApp button
 *
 * Setup: paste into Extensions → Apps Script of a new Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).
 */

var NOTIFY_EMAIL = 'weddings.theunposedstory@gmail.com';
var SHEET_NAME   = 'Enquiries';
var TIMEZONE     = 'Asia/Kolkata';

var HEADERS = ['Received (IST)', 'Ref', 'Status', 'Name', 'Partner', 'WhatsApp', 'Email',
               'Wedding date', 'City / venue', 'Collection', 'Guests', 'About the wedding',
               'Source', 'Chat on WhatsApp'];
var STATUSES = ['New', 'Contacted', 'Call booked', 'Quote sent', 'Booked', 'Lost'];

/* ---------- Web app endpoints ---------- */

function doPost(e) {
  try {
    var d = parseBody_(e);

    // Spam trap: real visitors never fill the hidden "website" field
    if (d.website) return json_({ ok: true });
    if (!d.name || !d.phone) return json_({ ok: false, error: 'Missing name or phone' });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = getSheet_();
      var ref = clean_(d.ref, 20) || ('TUS-' + String(Date.now()).slice(-6));
      // Ignore duplicate submissions of the same enquiry
      if (sh.getLastRow() > 1) {
        var refs = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) return json_({ ok: true, ref: ref, duplicate: true });
      }
      var phoneDigits = toWaNumber_(d.phone);
      var row = [
        new Date(), ref, 'New',
        clean_(d.name, 120), clean_(d.partner, 120), clean_(d.phone, 30), clean_(d.email, 120),
        clean_(d.date, 20), clean_(d.location, 200), clean_(d.package, 60), clean_(d.guests, 30),
        clean_(d.message, 3000), clean_(d.source, 80) || 'Website',
        phoneDigits ? '=HYPERLINK("https://wa.me/' + phoneDigits + '","Open chat")' : ''
      ];
      sh.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    sendEmail_(d, ref, phoneDigits);
    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'The Unposed Story enquiries' });
}

/* ---------- Email notification ---------- */

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
      '<div style="padding:22px 24px;background:#FBF8F3">' +
        '<table style="border-collapse:collapse;width:100%">' + table + '</table>' +
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
    body: plain,
    htmlBody: html,
    name: 'The Unposed Story Website'
  });
}

/* ---------- Sheet setup ---------- */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(SHEET_NAME) : ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) formatSheet_(sh);
  return sh;
}

function formatSheet_(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setFontColor('#F3E3C0').setBackground('#8B1230')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);
  var widths = [150, 95, 110, 150, 140, 140, 190, 110, 170, 120, 90, 320, 150, 110];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange('A:A').setNumberFormat('dd mmm yyyy, h:mm am/pm');
  sh.getRange('L:L').setWrap(true);

  var statusRange = sh.getRange(2, 3, 1000, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  var colours = { 'New': '#FDE7C8', 'Contacted': '#DCEBFA', 'Call booked': '#E7DDF8', 'Quote sent': '#FFF3B8', 'Booked': '#CDEFD6', 'Lost': '#EEEEEE' };
  sh.setConditionalFormatRules(Object.keys(colours).map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(colours[s]).setRanges([statusRange]).build();
  }));
  sh.getParent().setSpreadsheetTimeZone(TIMEZONE);
}

/** Run once from the editor to create the tab and send yourself a test email. */
function setupAndTest() {
  getSheet_();
  doPost({ postData: { contents: JSON.stringify({
    ref: 'TEST-' + String(Date.now()).slice(-4), name: 'Test Couple', partner: 'Partner', phone: '+91 70452 78377',
    email: NOTIFY_EMAIL, date: '2027-02-14', location: 'Mumbai', package: 'Gold', guests: '200–500',
    message: 'This is a test enquiry. You can delete this row.', source: 'Setup test'
  }) } });
}

/* ---------- Helpers ---------- */

function parseBody_(e) {
  var d = {};
  if (e && e.postData && e.postData.contents) {
    try { d = JSON.parse(e.postData.contents); } catch (x) { d = {}; }
  }
  if (e && e.parameter) Object.keys(e.parameter).forEach(function (k) { if (d[k] === undefined) d[k] = e.parameter[k]; });
  return d;
}
function clean_(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max || 500);
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // stop formula injection
}
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
function esc_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
