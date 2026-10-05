# DONE — research wiki coverage summary

**Crawl date:** October 2026 · **Source data:** `research/data/` · **Wiki:** `research/wiki/`

## Files written (this resume run added the last 4 + DONE.md)

| File | Size | Status |
|---|---|---|
| `README.md` | 4.8 KB | ✅ pre-existing |
| `sitemap.md` | 11.4 KB | ✅ pre-existing |
| `navigation.md` | 6.0 KB | ✅ pre-existing |
| `features.md` | 6.6 KB | ✅ pre-existing |
| `content-model.md` | 7.2 KB | ✅ pre-existing |
| `school-facts.md` | 9.9 KB | ✅ pre-existing |
| `pages/` (16 files) | — | ✅ pre-existing |
| `assets.md` | 44.5 KB | ✅ **this run** |
| `design-audit.md` | 7.9 KB | ✅ **this run** |
| `url-map.md` | 5.4 KB | ✅ **this run** |
| `gaps.md` | 5.9 KB | ✅ **this run** |
| `DONE.md` | this file | ✅ **this run** |

## Coverage counts

- **Pages in pages.jsonl:** 139 (137 × 200, 2 × 404) — all 137 status-200 URLs appear in `sitemap.md` ✅
- **Distinct page templates documented in `pages/`:** 16 (home, about, board, staff, class-placement, tcml, ta-program, scrip, sponsors, registration, volunteer, handbook, contact, misc, other-posts, weekly-announcements)
- **Assets in assets.json:** 542 (457 images + 85 PDFs) — all 541 with a local file appear in `assets.md` ✅ (1 image `IMG_3218.jpg` failed download → flagged as broken)
- **PDFs:** 85 in assets.json + 4 in `assets/pdf/registration-portal/` = **89 total**, all listed in `assets.md` §7
- **Broken links documented:** 8 (in `gaps.md` §1)
- **Duplicate image sha256 groups:** 57 hashed files (in `assets.md` §6)
- **URL redirects mapped:** ~90 old URLs → new clean URLs (`url-map.md`)
- **School facts with source URL:** ~110 rows in `school-facts.md`

## Known limits

1. `modified_date` / `published_date` are `null` for all pages in `pages.jsonl` — sitemap "Modified" column is empty.
2. 2018 spam posts (`2018-19_week_07_announcement_chinese/_english`) excluded from content summarisation per task instructions; flagged for cleanup only.
3. Crawl did not capture HTTP response headers (HSTS, caching, security headers).
4. CJK filenames in assets.json use percent-encoded or underscore-padded forms; the wiki lists the on-disk filename.
5. `asset_pages.jsonl` (323 rows) contains raw `%PDF-1.5` binary in `text_main` for some PDF entries — treated as binary, not transcribed.
6. The 4 logo files (`SDCALogo-original.png`, `logo-favicon-*.png`) are **not** in `assets.json` (they were pulled from the site's header/footer, not from the media API). They are listed in `assets.md` §1 with their on-site URLs.
