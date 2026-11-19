# The Unposed Story — website project notes

Read this first before changing the site. It records the decisions behind the
November 2026 redesign so future work keeps them (or changes them on purpose).

## Business facts (source of truth for copy, schema, FAQ)
- Brand: **The Unposed Story** — Wedding Photography & Cinematic Films, Mumbai
- Founder & lead photographer: **Sandip Lade**
- WhatsApp / phone: **+91 70452 78377** (`917045278377` in wa.me links)
- Email: **weddings.theunposedstory@gmail.com**
- Instagram: **@theunposedstory**
- Based in Mumbai; covers pan-India + destination weddings
- Trust numbers used on site: 4.9 Google rating, 50+ weddings. Do NOT re-add
  "100% happy couples", "76 reviews" next to "50+ weddings", or a Clutch badge
  (removed as credibility problems).
- Old brand name "Varmala Frames" must not appear anywhere.
- Logo (Nov 2026 rebrand): olive "US" monogram + "THE UNPOSED STORY" + "Wedding Photography &
  Cinematic Films" (spelling now correct). Source 2000px on cream. Files in assets/img: logo.png
  (olive, full), logo-cream.png (footer/PDF), logo-header(.png|-cream.png) (monogram + name),
  logo-emblem.png, favicons (olive square, cream monogram). The old maroon/gold logo is retired.

## Packages (owner chose "Starting from" display)
| Tier | Price | Shown on site as |
|---|---|---|
| Essential (was "Basic") | ₹35,000 | "Starting from ₹35,000" |
| Silver | ₹55,000 | "On request" |
| Gold (Most loved) | ₹85,000 | "On request" |
| Platinum | ₹1,35,000 | "On request" |
Exact prices stay in the JSON-LD `makesOffer`. Add-ons listed without prices.
Open business point: drone add-on (₹5K) undercuts Gold — suggested ~₹12K.

## Design decisions
- Direction: **Editorial Luxury** — ivory `#F7F2EA` body, ink `#1E1A17`,
  brass `#A88B4A`, brand olive `#3D4724` (from the Nov 2026 logo) for buttons, footer, CTA band,
  builder top bar and PDF bands. (Was maroon `#8B1230` + gold before the rebrand.)
- Fonts: Cinzel (brand), Cormorant Garamond (headings), Manrope (body).
- Header is ivory with the olive logo exactly as designed.
- Mobile kept deliberately calm: single hero photo (no badge/inset), sticky
  bottom bar Call | WhatsApp | Check date, swipeable packages, 44px+ tap targets.
- Removed from old site: COCO AI widget (asked visitors for API keys),
  admin-panel "Portfolio Updates" gallery, base64-embedded images.

## Files
- `index.html` — homepage (SEO/AEO/GEO: H1 "Candid Wedding Photographer in Mumbai",
  "At a glance" answer block, FAQ mirrored in FAQPage schema, LocalBusiness +
  Person schema, Open Graph tags)
- `assets/site.css`, `assets/site.js` — design system + behaviour (no frameworks)
- `assets/img/*.webp` — portfolio (each has full + `-sm` size); `logo-header.png`,
  `logo.png`, `sandip.jpg`, favicons
- `robots.txt`, `sitemap.xml`, `.nojekyll`
- `docs/google-apps-script/Code.gs` — copy of the Enquiries sheet script

## Enquiry system (working, tested by owner Nov 2026)
1. Form submit opens WhatsApp to +91 70452 78377 with all details pre-typed
   (couple taps Send). Ref ID format `TUS-xxxxxx`.
2. Same data POSTed (no-cors, keepalive) to the Apps Script web app →
   new row in **Enquiries** sheet (Status: New/Contacted/Call booked/Quote sent/
   Booked/Lost) + instant email to weddings.theunposedstory@gmail.com with a
   "Reply on WhatsApp" button.
- Web app URL is `SCRIPT_URL` in `assets/site.js`. Sheet + script are owned by
  weddings.theunposedstory@gmail.com. To change the script: edit in Apps Script,
  then Deploy → Manage deployments → New version (URL stays the same).
- Hidden honeypot field `website` blocks bots (site + script both check it).

## Quotation builder (`/quote/`, added Nov 2026)
- Private PIN page: https://theunposedstory.github.io/portfolio/quote/ (noindex + robots Disallow).
  Try with sample data: `/quote/?demo=1` (nothing saved).
- Files: `quote/index.html`, `quote/app.css`, `quote/app.js`, `quote/vendor/html2pdf.bundle.min.js` (MIT, v0.10.1, self-hosted).
- Every download/share first opens the real PDF in a preview (rendered with `quote/vendor/pdfjs/`, pdf.js 3.11.174 legacy build, Apache-2.0); Download / Share on WhatsApp are tapped from there.
- Backend = same Apps Script (`docs/google-apps-script/Code.gs`): actions login, bootstrap, saveQuote,
  getQuote, setStatus, changePin, addPayment, voidPayment. PIN is hashed in Script Properties
  (first PIN entered becomes the PIN; `resetQuotePin()` in the editor clears it). 6-hour session tokens.
- Sheet tabs: Quotations (Q-YYYY-NNN), Payments (receipts R-YYYY-NNN, cancelled = "Void", never deleted),
  Price list (client price + private internal cost per package/add-on; yellow = sample estimates).
- Quote PDF follows the owner's template (cover band, prepared-for, event schedule, team scope,
  deliverables, itemised investment, payment schedule, T&C, signatures). No GST (owner not registered).
- Payment plans: 30/50/20 (default) and 50/50. First payment auto-sets quote Accepted + enquiry Booked.
- Private profit view: costs from Price list + extra costs; target margin 35% (TARGET_MARGIN in app.js).
- Service areas (from owner's template): Mumbai, Thane, Navi Mumbai, Pune, pan-India, destination.

## Website gallery uploads (added Nov 2026)
- Private **Gallery** tab in the quote builder (`/quote/#gallery`, same PIN). Choose section
  (wedding / prewedding / haldi / bridal) + description, upload up to 20 photos; resized in the
  browser to max 2000px JPEG before upload.
- Backend (`Code.gs`): actions galleryList, uploadImage, updateImage, deleteImage (PIN token);
  public `GET ?action=gallery` returns visible items. Files saved in the owner's Drive folder
  "The Unposed Story – Website Gallery" (shared "anyone with link → view"); rows in the **Gallery** sheet tab.
  Delete = Drive bin (30 days). Run `setupGallery()` once after deploying (grants Drive scope).
- Website (`assets/site.js`): fetches the gallery list (cached in localStorage `tus_gal`), adds uploads
  first in each tab via `https://lh3.googleusercontent.com/d/<fileId>=w<size>`; filter tabs + lightbox
  work for built-in and uploaded photos. Built-in photos in `index.html` stay as the SEO baseline.

## Service pages (added Nov 2026)
- `/wedding-photography/`, `/pre-wedding-shoot/`, `/cinematic-wedding-films/`, `/haldi-bridal-photography/`.
- Generated by `python3 docs/tools/build_service_pages.py` (copies header/footer/fab/mbar/steps from
  `index.html`, rewrites paths one folder deep). Edit copy/FAQs in that script and re-run; re-run after
  any header/footer change on the homepage. Schema per page: Service + BreadcrumbList + FAQPage.
- Each page's `.gallery[data-only]` shows built-in photos of its section(s) + uploads for those sections.
- Homepage service cards and footer "Services" link to these pages; all are in `sitemap.xml`.

## Hosting / deploy
- GitHub Pages from `main` of `theunposedstory/portfolio`
  → https://theunposedstory.github.io/portfolio/
- Previous (pre-redesign) site: commit `9a93f4f`.
- Moving to a custom domain: replace `https://theunposedstory.github.io/portfolio/`
  in `index.html`, `robots.txt`, `sitemap.xml`.

## Not done yet (agreed next steps)
1. Multi-page build: service pages DONE (Nov 2026). Still to do: location pages
   (Thane, Navi Mumbai, Pune), and optionally Packages / About / FAQ pages. Needs from
   owner: service areas, delivery timelines, booking advance %, reviewer names
   + Google Business Profile link.
2. Google Search Console + sitemap submission; add site link to Google Business Profile.
3. Corrected logo ("Films").
4. Optional: fully automatic WhatsApp alerts need WhatsApp Business API
   (AiSensy/WATI/Meta) via server-side script — the `whatsaapp-api` repo is a
   browser-only bulk tool and must not be used from the public site.
