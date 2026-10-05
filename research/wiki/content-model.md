# Content Model — data entities hidden in the old site's content

The old site is content-heavy but schema-poor (everything is a WordPress page or post).
Below are the **logical entities** that the content implies, with the fields we can
observe, intended to be stored in **SQLite** for the new site. Counts are from the crawl.

## 1. `page` — static site pages

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| slug | text unique | e.g. `about-sdca`, `tcml`, `registration` |
| title_en | text | |
| title_zh | text | |
| body_en | text | markdown |
| body_zh | text | markdown |
| nav_order | int | menu position |
| nav_section | text | About / Class / Parent Info / … |
| published | bool | |

**Count**: 32 WP pages (see `sitemap.md`).
Examples: home, about-sdca, board-of-directors, staff, class-placement, tcml,
adult-recreational-programs, ta-program, registration, handbook-and-policy, scrip,
sponsors, sponsors-2, volunteer-opportunity, news, news-archive, media, upcoming-event,
countact-us, privacy-policy, disclaimer, education-resource, parent-info-old,
words-from-the-principal, 校長的話, bod, adult, sdca-ad-half-page,
new-student-advertisments-2026, student-store-schedule, 吉他的,
upcoming-event/summer-break-2.

## 2. `announcement` / `post` — weekly announcements & event notices

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| slug | text unique | `w25_news_chn`, `2026-essay-application` |
| title | text | as on site |
| week_no | int nullable | 1–29 for weekly |
| school_year | text nullable | e.g. `2025-26` |
| lang | text | `en` / `zh` |
| body | text nullable | usually empty (content in PDF) |
| published_date | date nullable | from URL/upload date |
| is_spam_polluted | bool | true for 2018 W07 + pre-k |

**Count**: 96 posts (≈60 weekly-announcement posts + ~30 event/PDF/photo posts).

## 3. `event` — dated happenings (from home "Upcoming Event" + media captions)

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| title_en | text | |
| title_zh | text | |
| event_date | date | |
| category | text | meeting / exam / contest / festival / ceremony |
| location | text nullable | room / campus |
| description | text nullable | |

**Count (observed on home at crawl)**: 6 upcoming events + ~30 historical media
captions (Cultural Day, Graduation, Halloween, Flag Raising, Poetry Recitation, etc.).
Not a hard DB table today; the home page list is the source.

## 4. `class` / `program` — the class ladder

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| name_en | text | Pre-K, Beginner, Level K, Regular, Bilingual, Credit, Adult |
| name_zh | text | 學前班, 入門班, 注音班, 普通班, 雙語班, 學分班, 成人班 |
| level | text | pre-k / k-12 / adult |
| pinyin_system | text nullable | ZhuYin / PinYin / both |
| age_range | text nullable | 4–18 / 18+ |
| description_en | text | |
| description_zh | text | |
| credits | bool | true for Credit class |
| info_pdf | text nullable | e.g. `Beginner-Class.pdf` |
| image | text nullable | |

**Count**: 7 core class types (學前班、注音班、拼音班、普通班、雙語班、學分班、成人班)
+ TCML adult center + recreational (Dance/Yoga/Baseball). ~10 programs total.
Site says "about 30 classes" (instances) and "19 classes" (TCML page) — see `gaps.md`.

## 5. `grade_level`

| Field | Notes |
|-------|-------|
| label | Pre-K, K, 1–12, Adult |
| class_id | FK → class |

Implied by "Pre-kindergarten to Grade 12" (home) and the class ladder.

## 6. `staff` / `person`

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| name_zh | text | |
| name_en | text | |
| role | text | board / principal / teacher / ta / pta |
| board_title_zh | text nullable | 理事長 … |
| board_title_en | text nullable | PRESIDENT … |
| bio | text nullable | |
| photo | text nullable | |

**Count**: 9 board members (listed) + 1 principal (孫麗敏 Sun Li-Min, from the
letter sign-off) + named volunteers/contacts (Celine Chen – yoga, Jerry Han – baseball,
Lai Chen – food). Teachers themselves are **not individually named** on the site
(only group photos) → see `gaps.md`.

## 7. `board_member` (subset of staff) — 9 rows, see `pages/board-of-directors.md`.

## 8. `sponsor`

| Field | Notes |
|-------|-------|
| name | 99 Ranch, Mandrin House, Law Offices of Peter Darwin Chu, C2 Education, Dr. Liu, Golden Vision, East West Bank |
| logo_image | file path |
| type | business / individual |

**Count**: 7 logos on `/sponsors-2/` + scrip sponsors (in `Scrip Logos.pdf`).

## 9. `document` / `form` (PDFs)

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| filename | text | as stored |
| title_zh | text nullable | |
| title_en | text nullable | |
| category | text | handbook / policy / form / calendar / contest / class-info / scrip / registration |
| url | text | clean new URL |
| old_url | text | for 301 |
| bytes | int | |
| sha256 | text | dedup |

**Count**: 85 PDFs (see `assets.md`). Plus 5 portal PDFs on the register subdomain.

## 10. `image` (assets)

| Field | Type | Notes |
|-------|------|-------|
| id | int PK | |
| filename | text | |
| purpose | text | logo / header / classroom / event / staff / sponsor / news / decorative / pdf-thumb |
| width, height | int | |
| bytes | int | |
| alt_en, alt_zh | text nullable | (old site alts are mostly empty) |
| has_people | bool | **never regenerate these** |
| sha256 | text | dedup (34 dup groups found) |

**Count**: 454 images (457 entries in assets.json incl. 1 broken). See `assets.md`.

## 11. `external_link`

| Field | Notes |
|--------|-------|
| label | Facebook / YouTube / Yelp / PTA blog / Google Drive / AmazonSmile / iGive / eScrip / press articles |
| url | |
| kind | social / photo / video / fundraising / press / form |

**Count**: ~20 distinct external links across pages (see `features.md` table).

## 12. `donation_channel`

| Field | Notes |
|--------|-------|
| kind | paypal / check / amazon_smile / igive / escrip / scrip |
| details | URL / address / instructions |

**Count**: 6 channels (see `/sponsors/`).

## Suggested SQLite schema (summary)

```
page(id, slug, title_en, title_zh, body_en, body_zh, nav_order, nav_section, published)
announcement(id, slug, title, week_no, school_year, lang, body, published_date, is_spam_polluted)
event(id, title_en, title_zh, event_date, category, location, description)
class(id, name_en, name_zh, level, pinyin_system, age_range, description_en, description_zh, credits, info_pdf, image)
person(id, name_zh, name_en, role, board_title_zh, board_title_en, bio, photo)
sponsor(id, name, logo_image, type)
document(id, filename, title_zh, title_en, category, url, old_url, bytes, sha256)
image(id, filename, purpose, width, height, bytes, alt_en, alt_zh, has_people, sha256)
external_link(id, label, url, kind)
donation_channel(id, kind, details)
```

All text columns UTF-8. Bilingual fields stored separately (not translated at runtime)
so EN and 繁體 can be served independently — fixing the old site's "no switcher" problem.
