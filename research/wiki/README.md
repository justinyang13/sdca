# SDCA Old-Site Research Wiki (Phase 1B)

> Research snapshot of **https://sandiegochineseschool.com/** as crawled for the rebuild project.
> Source data: `research/data/pages.jsonl` (139 pages), `research/data/assets.json` (542 assets),
> `research/raw/pages/` (raw HTML), `research/assets/` (downloaded images & PDFs).
> Crawl date: 2026-10 (Phase 1A).

## What the school is

**San Diego Chinese Academy 聖地牙哥中華學苑 (SDCA)** is a non-profit California
organization founded in **1988** that teaches Mandarin Chinese language and culture
to children (Pre-K through Grade 12, including high-school credit classes) and adults
(TCML adult program, recreational classes). Classes meet on **Sunday afternoons**
at **La Jolla Country Day School** (since Fall 1991; 1988–1990 at UCSD).
The school is **WASC-accredited** and claims ~30 classes with <20 students per class.
Sources: `about-sdca/` page, home page (see `pages/about-sdca.md`, `school-facts.md`).

## What the old site is

- **Platform**: WordPress **6.2.13**, theme **OceanWP 1.5.28**, page builder **Elementor 3.23.4**,
  slider plugin **Smart Slider 3** (v.~5.0, asset timestamp 2019), extras plugin **Ocean Extra**.
  All confirmed from `<meta name="generator">` and `<link rel=stylesheet>` tags in `raw/pages/home.html`.
- **Structure**: 31 distinct "real" pages (WordPress pages) + 97 blog posts
  (weekly announcements, event posts, PDF wrapper posts) + 5 WP sitemaps + 1 category
  archive + 2 author archives + 2 known-404 registration URLs + 1 OceanWP header template.
- **Registration** is delegated to an external Rails app at
  **`register.sandiegochineseschool.com`** (sign-in / new-family / returning-student flows),
  with 5 public PDF documents on that subdomain.
- **Donations**: PayPal hosted button on `/sponsors/`; check-by-mail; AmazonSmile, iGive, eScrip links.
- **Content is bilingual** English + Traditional Chinese (繁體), side-by-side on most pages.
- **Known problems**: comment spam on the two oldest posts (drug/pharmacy/casino spam,
  thousands of entries, ~27 MB of HTML per post), several 404 PDFs, broken
  `register…/signin` links, duplicate PDF files, 34 duplicate-image sha256 groups,
  a mix of old (2018) and new (2026) assets, no mobile-first design, no visible
  language switcher (bilingual text is baked into each page).

## Wiki files (this directory)

| File | Purpose |
|------|---------|
| `README.md` | This index & summary |
| `sitemap.md` | Every crawled URL with title, type, status |
| `navigation.md` | Exact header/footer menu structure + language behaviour |
| `pages/home.md` | Home page |
| `pages/about-sdca.md` | About SDCA |
| `pages/board-of-directors.md` | Board of Directors |
| `pages/staff.md` | Staff / Words from the Principal |
| `pages/class-placement.md` | Class Placement (K–12 descriptions) |
| `pages/tcml.md` | Adult TCML program |
| `pages/adult-recreational-programs.md` | Dance / Yoga / Baseball |
| `pages/ta-program.md` | TA (Teaching Assistant) program |
| `pages/registration.md` | Registration + external portal |
| `pages/handbook-and-policy.md` | Handbook & Policy & Forms |
| `pages/scrip.md` | Scrip (gift-card) program |
| `pages/sponsors.md` | Donation & Sponsor pages (two) |
| `pages/volunteer-opportunity.md` | Volunteer |
| `pages/news.md` | News index (press mentions) |
| `pages/media.md` | Media gallery index |
| `pages/upcoming-event.md` | Weekly Announcement index |
| `pages/weekly-announcements.md` | Table of all weekly announcement posts (EN/ZH pairs) |
| `pages/other-posts.md` | All remaining posts (events, PDFs, calendars, contests) |
| `pages/contact.md` | Contact Us |
| `pages/legal.md` | Privacy Policy, Terms, Disclaimer, Portal |
| `pages/misc.md` | Smaller real pages (education-resource, bod, adult, student-store-schedule, 吉他的, parent-info-old, news-archive, sample-page) |
| `features.md` | Every functional feature (registration, PayPal, Google Forms, sliders, YouTube, calendar, contact, search, comments, login) |
| `content-model.md` | Data entities (post, event, class, grade, staff, sponsor, document) |
| `school-facts.md` | Canonical list of all real facts with source URLs |
| `assets.md` | Catalogue of 454 images + 85 PDFs, grouped by purpose |
| `design-audit.md` | Theme, colors, fonts, layout, performance, accessibility, SEO, security |
| `url-map.md` | Old URL → proposed new URL (for 301 redirects) |
| `gaps.md` | Broken links, 404s, contradictions, open questions |
| `DONE.md` | Coverage counts & limitations |

## How to read Chinese text in this wiki

All Chinese text is **Traditional Chinese (繁體)**, kept **verbatim** from the crawled
pages. Simplified Chinese appears only where the original site used it (rare).
English and Chinese sections appear together exactly as they do on the site.
