# Gaps, contradictions, unknowns & questions

Everything below is traced to crawl data (`data/broken_links.json`, `data/pages.jsonl`,
`raw/pages/*.html`, `data/assets.json`). No invented facts.

## 1. Broken links (from `data/broken_links.json`, 8 total)

| Broken URL | Type | Impact |
|---|---|---|
| `/registration/signin` | 404 | **Primary registration entry is broken** — the `/registration/` page links here. |
| `/registration/signin/register` | 404 | Registration sign-in/register flow 404s. |
| `/wp-content/uploads/2019/07/Peggy-Han.jpeg` | 404 image | Staff photo missing (Peggy Han — likely staff/teacher). |
| `/SDCA_Donation_Form%20-%202008.pdf` | 404 PDF | Donation form link dead (2008-dated form). |
| `/newsletter/World%20Journal%20Poetry%20Recitation%20and%20Karaoke%20Mar%202017.pdf` | 404 PDF | Old press item missing. |
| `/newsletter/We%20Chinese%20Interview%20SDCA%20Sept%202016.pdf` | 404 PDF | Old press item missing. |
| `/registration/Volunteer%20Job%20Descriptions.pdf` | 404 PDF | Volunteer info PDF missing. |
| `/wp-content/uploads/2025/12/IMG_3218.jpg` | 404 image | New image missing (also the one 0-byte asset in assets.json). |

## 2. Duplicate / conflicting URLs

- `/sponsors/` and `/sponsors-2/` both titled "Sponsors" — which is canonical? (sitemap.md)
- `/2026-27_school_calendar/` and `/2026-27_school_calendar-2/` — two versions of the same
  calendar page (2026-27 calendar PDF has two near-identical copies too, assets.md §8).
- `/2026-2027-first-day-of-school/` and `/2026-first-day-of-school-2/` — duplicated first-day post.
- `/handbook-and-policy/` vs `/parent-info-old/` — parent-facing content split across two pages.
- `/bod/` vs `/board-of-directors/` — duplicate board pages.
- 57 hashed duplicate images (Elementor re-uploads), assets.md §6.

## 3. Contradictions across pages

- **Founding location**: About says founded 1988 at UCSD, moved to La Jolla Country Day School
  in Fall 1991. Some older event posts reference different venues (e.g. 2018 posts mention
  various rooms). Need to confirm the **current** single location (La Jolla Country Day School)
  is still correct.
- **WASC accreditation**: claimed on `/about-sdca/` — no certificate number or date given.
  Verify current accreditation status.
- **Class count**: "≈30 classes, <20 students/class" (about) vs class-placement page lists a
  specific K–12 ladder. Reconcile the exact current roster.
- **Tuition**: never published on any page (school-facts.md confirms). Only the $100 volunteer
  service fee and dance punch-card fees are stated. **Tuition is a key missing fact.**
- **Bell schedule**: nav links a 2018-10 `Class-Schedule.pdf` (old), while class-placement page
  may reference a newer one. Which is current?
- **Textbooks**: nav links the 2018-2019 P07 textbook PDF — clearly stale for a 2026 site.

## 4. Missing information (not found anywhere in crawl)

- **Current tuition & fee schedule** — not on site.
- **Registration dates / deadlines** for the upcoming year — not clearly stated (only
  "pre-registration" GIF + external portal).
- **Staff roster completeness** — Peggy Han photo 404s; is she still staff?
- **Board meeting cadence / bylaws** — not published.
- **Physical address + hours** — location named (La Jolla Country Day School) but no street
  address, parking, or exact class hours on a single canonical page.
- **Map embed** — no Google Maps iframe found in crawled HTML (limitation; may be JS-loaded).
- **E-learning / online class details** — features.md mentions e-learning; confirm current offering.
- **Newsletter mechanism** — no email signup form fields captured in crawl (Google Forms link
  exists at `/`; confirm the actual newsletter flow).
- **Facebook/Instagram handle currency** — `/support/` links; verify still active.

## 5. Unknowns (could not be resolved from data)

- Exact current **school-year calendar** start/end dates (2025-26 calendar PDF exists;
  2026-27 calendar PDF exists — read them for the canonical dates; not transcribed here).
- Whether the **e-learning platform** is the external portal or a separate tool.
- The **PayPal donation button** exact amount / campaign (features.md documents the flow, not
  the configured amounts).
- Which of the two **Scrip pages** (`/scrip/` vs Scrip graphics) reflects the current program.

## 6. Questions for the school

1. What are the current tuition rates for each level (Pre-K → Grade 12, credit, adult)?
2. Is the single current location La Jolla Country Day School? What is the street address?
3. Who is on the current board and staff? (Peggy Han photo is missing — confirm roster.)
4. What are the registration open/close dates for the next year, and the late-registration policy?
5. Is the school still WASC-accredited? (provide certificate)
6. Which is the canonical Sponsors page and current sponsor list?
7. Confirm the current bell schedule and textbook list (the 2018 PDFs linked in nav are stale).
8. Do you have an SVG/vector master of the logo seal for the new site?
9. What is the current newsletter / email-list mechanism?
10. Is e-learning currently offered, and on what platform?

## 7. Crawl limitations (affects this wiki)

- `modified_date`/`published_date` = `null` for all pages in `data/pages.jsonl` — so sitemap.md
  "Modified" column is empty. The WP REST API `modified` field was not populated in the crawl.
- `asset_pages.jsonl` (323 rows) contains some PDF `text_main` starting with `%PDF-1.5` (raw
  binary captured) — treated as PDF assets, not readable text.
- 2018 spam posts (`2018-19_week_07_announcement_chinese/_english`) contain ~6,000+ spam
  comment entries each (drug/pharmacy/pill/casino). **Excluded from content summarisation** per
  task instructions; flagged only for cleanup.
- Crawl did not capture HTTP response headers (HSTS, caching, security headers) — design-audit
  §9 notes this.
