# Design audit — how the old site looks & behaves

All observations come from `research/raw/pages/*.html` (raw HTML), `data/pages.jsonl`
(text, meta, forms, images, plugins), and `data/assets.json` (sizes). No invented claims.

## 1. Stack & theme

- **WordPress 6.2.13** + theme **OceanWP** + page builder **Elementor 3.23.4** (confirmed in
  `<meta name="generator" content="Elementor 3.23.4 ...; WordPress 6.2.13">`, `raw/pages/home.html`).
  Plugins detected in markup: `elementor`, `smart-slider-3`, `ocean-extra` (`data/pages.jsonl` `plugins`).
- **Smart Slider 3** is 5+ years old (asset query string `?1566328342` ≈ 2019), still used for
  the home hero slider.
- All pages are server-rendered PHP + Elementor CSS-in-inline style blocks; home page HTML is
  **182 KB** raw (≈ 680 KB average across all 464 saved HTML files in `raw/pages/`).
- **No JavaScript framework, no SPA** — fine for a content site, but Elementor ships a large
  CSS+JS payload on every page (24 `<script>` tags on home).

## 2. Visual identity

- **Logo**: round red/blue Chinese seal `SDCALogo-original.png` (512×512, 39 KB) top-left of
  header, repeated in footer. Favicon set `logo-favicon-{32,180,192}.png`. (assets.md §1.)
- **Colour palette** (from inline Elementor styles in raw HTML): deep **red** (≈ #c0392b-ish,
  used for "Enroll"/CTA buttons and headings), **navy blue** (header background), white content
  areas, light-grey section bands. Red/blue is the consistent brand pair across banners
  (e.g. `SDCA-Ad-half-page.jpg`, `2026-essay-ad.png`, Scrip graphics).
- **Fonts**: system/Google-free stack; CJK text relies on system Chinese fonts. No webfont
  loading found on home page (`fonts.googleapis` absent) — so CJK rendering quality varies by
  device.
- **Layout pattern** (home, `raw/pages/home.html`):
  1. Thin top bar (contact, school year) → 2. Header with logo + OceanWP menu (8 top items, 2
  dropdowns) → 3. **Smart Slider 3 hero** (school photos + 2026 pre-registration banner GIF)
  → 4. Bilingual welcome text 聖地牙哥中華學苑成立於1988年… → 5. 3-column feature cards
  (classes / cultural activities / registration) with photos → 6. Weekly-announcement PDF
  links row → 7. Sponsors/ad strip → 8. Footer (contact info, legal links, social icons).
- **Photos are heavy and unoptimised**: many originals are 2000–4032 px wide (e.g.
  `SDCA-Community-Service.jpeg` 5.7 MB, `Sign-UP-GIF.gif` 4.6 MB, `2018-2019-Teachers.jpg`
  3.1 MB) served at display sizes of ~300–768 px. No WebP/AVIF, no `srcset` in observed markup.

## 3. What works

- **Content is comprehensive**: EN+ZH side by side on every page; every program, policy, form,
  calendar, and 38 years of weekly announcements are present.
- **Consistent bilingual voice**; the weekly-announcement PDF pattern (EN + 中文 PDF per week)
  is a genuinely useful parent workflow.
- **Working registration** via external subdomain, and PayPal donation — core business flows exist.
- Deep-linkable PDF library (handbook, policies, calendars, class schedules).

## 4. What is outdated

| Issue | Evidence |
|---|---|
| Elementor 3.23.4 + WordPress 6.2.13 are several versions behind (WP 6.2 is from Dec 2022) | `raw/pages/home.html` generator meta |
| Smart Slider 3 asset from 2019 | `?1566328342` in `raw/pages/home.html` |
| `ocean-extra` plugin present | `data/pages.jsonl` plugins |
| Menu links to 2018-19 PDFs still live (Bell Schedule 2018-10, Textbooks 2018-2019-P07) | `navigation.md` items 6.3/6.4 |
| `/countact-us/` slug typo in primary nav | `navigation.md` item 5 |
| Duplicated page slugs: `/sponsors/` vs `/sponsors-2/`, `/2026-27_school_calendar/` vs `-2`, `/img_XXXX` auto-slugs for uploaded photos | sitemap.md |
| Author archive pages exposed (`/author/admin/`, `/author/webmaster/`) | sitemap.md |
| `/sample-page/2026-essay-ad/` — a child "page" of the default Sample Page | internal links dump |
| 34 hashed duplicate image files (Elementor re-upload behaviour) | assets.md §6 |

## 5. Mobile

- OceanWP is responsive in principle, but the site is **desktop-first built in Elementor**:
  large full-bleed photos (3000+ px) load before downscaling; the hero is an animated GIF
  (`Sign-UP-GIF.gif`, `2026-Pre-registration.gif`) which is data-hungry on phones.
  No viewport-optimised asset variants observed (no `srcset` in crawled HTML).
- The 8-item horizontal header menu with 2 dropdowns is tight on a 375 px viewport
  (labels: Home / About / Weekly Announcement / News / Contact Us / Class / Media / Parent Info…).

## 6. Accessibility

- **Alt text is empty on essentially all images** (`data/assets.json` `alt` = "" for every
  entry; `data/pages.jsonl` images). A11y fail.
- CJK + English mixed content has **no `lang` attribute per block** in observed markup
  (page `lang` = `zh-TW` at `<html>` level on home, but EN paragraphs are untagged).
- **Colour contrast**: white text on mid-red buttons is borderline; needs a WCAG check.
- PDFs are the primary content vehicle for weekly announcements — not keyboard/screen-reader
  friendly as primary content.
- No visible skip-link; Elementor-generated landmark structure is inconsistent.

## 7. SEO

| Item | Finding |
|---|---|
| Titles | Present & bilingual on every page, e.g. `San Diego Chinese Academy 聖地牙哥中華學苑 – Non-profit language school teaching Mandarin and Chinese culture since 1988` (home). Good. |
| Meta description | Present on most pages (home has a ZH description). Some posts reuse default. |
| OG tags | `og:title`/`og:description`/`og:url`/`og:site_name` present on home (`raw/pages/home.html`). |
| Canonical | Standard WordPress self-canonical expected; not verified in crawl (limitation). |
| Sitemaps | WP auto sitemaps exist and were crawled (5 xml). |
| URLs | Mixed quality: good slugs (`/about-sdca/`) next to auto-slugs (`/img_5827/`), percent-encoded Chinese slugs (`/%E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1/`), and duplicate suffixed slugs (`-2`, `-4`, `-5`, `-6`). See `url-map.md`. |
| 404 handling | Two registration URLs 404 (see `gaps.md`). |

## 8. Performance

- **Page weight is the top problem**: home HTML 182 KB + 152 MB total image library, with
  individual originals up to 5.7 MB served inline; no compression/resize evidence.
- 24 script tags + 19 stylesheet links on home (Elementor per-page CSS chunks).
- Animated GIFs in the hero (`Sign-UP-GIF.gif` 4.6 MB, `2026-Pre-registration.gif` 343 KB).
- Recommendation: modern image pipeline (WebP/AVIF + responsive sizes), defer Elementor CSS,
  lazy-load below-the-fold, static host.

## 9. Security & hygiene

- **Comment spam**: the two oldest posts (`/2018-10-19/2018-19_week_07_announcement_chinese/`
  & `_english/`) contain thousands of drug/pharmacy/pill comment-spam entries — raw HTML files
  contain 6,464 and 5,949 matches for pharmacy/pill/cheap terms respectively
  (`grep -icE` over `raw/pages/`). These two posts bloat the site and are a spam magnet.
- **Exposed internals**: author archives, `?oceanwp_library=sdca-header` template URL,
  `/sample-page/…` child pages, `/registration/signin*` 404s revealing the app structure.
- **Outdated plugin surface** (Elementor 3.23.4, Smart Slider 3 2019 build, Ocean Extra) —
  higher attack surface than current releases.
- No HSTS/redirect anomalies observed in crawl (limitation: crawl didn't capture headers).

## 10. Summary scorecard

| Area | Old site | New site should |
|---|---|---|
| Content depth | ★★★★★ | Keep (this wiki is the spec) |
| Visual brand | ★★★ | Keep red/blue + seal logo, modernise layout |
| Mobile | ★★ | Mobile-first, responsive images |
| A11y | ★ | Alt text everywhere, lang tags, contrast, keyboard nav |
| SEO structure | ★★★ | Clean slugs (url-map.md), one canonical page per topic |
| Performance | ★ | <200 KB first paint, WebP/AVIF, no giant GIFs |
| Security | ★★ | Fresh stack, no exposed admin surfaces, comment policy |
