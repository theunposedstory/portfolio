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
- Logo file contains a typo: "Cinematic **Flims**". Header logo crop excludes
  that line; footer shows the full logo. Swap in a corrected logo when available.

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
  gold `#B8893E`, brand maroon `#8B1230` (from logo) for header, footer, CTA band.
- Fonts: Cinzel (brand), Cormorant Garamond (headings), Manrope (body).
- Header is maroon so the exact gold logo stays legible (gold on ivory was too pale).
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

## Hosting / deploy
- GitHub Pages from `main` of `theunposedstory/portfolio`
  → https://theunposedstory.github.io/portfolio/
- Previous (pre-redesign) site: commit `9a93f4f`.
- Moving to a custom domain: replace `https://theunposedstory.github.io/portfolio/`
  in `index.html`, `robots.txt`, `sitemap.xml`.

## Not done yet (agreed next steps)
1. Multi-page build (owner chose multi-page): Portfolio, Pre-wedding, Packages,
   About, FAQ, Contact + location pages (e.g. Thane, Navi Mumbai). Needs from
   owner: service areas, delivery timelines, booking advance %, reviewer names
   + Google Business Profile link.
2. Google Search Console + sitemap submission; add site link to Google Business Profile.
3. Corrected logo ("Films").
4. Optional: fully automatic WhatsApp alerts need WhatsApp Business API
   (AiSensy/WATI/Meta) via server-side script — the `whatsaapp-api` repo is a
   browser-only bulk tool and must not be used from the public site.
