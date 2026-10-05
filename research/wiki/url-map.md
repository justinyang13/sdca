# URL map — old URL → proposed new URL (301 redirects)

Proposed clean URL scheme for the new site. Every old URL found in
`data/pages.jsonl` (status 200 or 404) is covered. `→` = 301 redirect target;
`=` = stays the same. Weekly-announcement PDF wrapper posts collapse into
`/announcements/` with year-week anchors. Slugs are ASCII-lowercase, hyphenated.

## Core pages

| Old URL | → New URL | Notes |
|---|---|---|
| `/` | `/` | home |
| `/about-sdca/` | `/about/` | |
| `/%E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1/` (校長的話) | `/about/principal-message/` | was a separate page; fold under About |
| `/board-of-directors/` | `/about/board/` | |
| `/bod/` | `/about/board/` | duplicate of board-of-directors |
| `/staff/` | `/about/staff/` | |
| `/class-placement/` | `/classes/` | class descriptions K–12 |
| `/tcml/` | `/classes/adult-tcml/` | |
| `/adult-recreational-programs/` | `/classes/recreational/` | dance/yoga/baseball |
| `/ta-program/` | `/about/ta-program/` | |
| `/volunteer-opportunity/` | `/get-involved/volunteer/` | nav label "Parent Info → Volunteer" |
| `/parent-info-old/` | `/parents/handbook/` | old parent info |
| `/handbook-and-policy/` | `/parents/handbook/` | keep one canonical; redirect other |
| `/scrip/` | `/students/scrip/` | Scrip credit program |
| `/education-resource/` | `/parents/resources/` | "Resource" |
| `/sponsors/` and `/sponsors-2/` | `/support/sponsors/` | collapse duplicate pair |
| `/sdca-ad-half-page/` | `/support/advertise/` | ad placement page |
| `/registration/` | `/register/` | entry point to registration flow |
| `/countact-us/` | `/contact/` | fix typo slug |
| `/news/` | `/news/` | |
| `/news-archive/` | `/news/` | archive collapses into news index |
| `/media/` | `/media/` | photo gallery |
| `/upcoming-event/` | `/announcements/` | weekly announcement index (nav label "Weekly Announcement") |
| `/category/weekly-announcement/` | `/announcements/` | category archive → same index |
| `/disclaimer/` | `/legal/disclaimer/` | |
| `/privacy-policy/` | `/legal/privacy/` | |
| `/new-student-advertisments-2026/` | `/register/new-students/` | 2026 recruiting page (fold under register) |
| `/sample-page/2026-essay-ad/` | `/events/2026-essay/` | stray Sample Page child; move content |
| `/%E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1/` (吉他海報) | `/classes/adult-instruments/` | guitar flyer |
| `/?oceanwp_library=sdca-header` | — | do NOT redirect; drop (Elementor template URL) |
| `/author/admin/` | `/` | drop author archives (redirect home) |
| `/author/webmaster/` | `/` | drop author archives |

## Event / announcement posts → `/announcements/{slug}/`

| Old URL | → New URL |
|---|---|
| `/2018-10-22/pre-k-program/` | `/announcements/2018-10-22-pre-k-program/` |
| `/2025-2026-…38週年校慶暨春節園遊會program_guide/` | `/announcements/2025-38th-anniversary-spring-fair/` |
| `/2025-2026-詩詞朗誦比賽規則及詩詞/` + `-2/` | `/announcements/poetry-recitation-rules/` (collapse dup) |
| `/2025-2026_school_calendar-03152026/` | `/announcements/2025-2026-school-calendar/` |
| `/2025-26_sdca_作文比賽辦法/` | `/announcements/2025-2026-essay-competition/` |
| `/2026-中國館中文比賽通知/` | `/announcements/2026-chinese-center-contest/` |
| `/2026-2027-first-day-of-school/` + `/2026-first-day-of-school-2/` | `/announcements/2026-2027-first-day/` (collapse dup) |
| `/2026-27_school_calendar/` + `-2/` | `/announcements/2026-2027-school-calendar/` (collapse dup) |
| `/2026-essay-application/` | `/announcements/2026-essay-application/` |
| `/2026-hoc-essay-english-announcement/` | `/announcements/2026-hoc-essay/` |
| `/2026-pre-registration/` | `/register/` |
| `/2026_2027_classroom-map/` | `/announcements/2026-2027-classroom-map/` |
| `/sdca-yearbook-cover-art-contest-guidelines-2025-2026/` | `/announcements/yearbook-cover-contest-2025/` |
| `/student-store-schedule/` | `/announcements/student-store-schedule/` |
| `/dinner-3/` | `/announcements/teacher-appreciation-dinner/` |
| `/screenshot/`, `/screenshot-2/`, `/screenshot-3/` | `/media/` (image posts → gallery) |
| `/img_2885/ … /img_8989/` (12 photo posts) | `/media/` (collapse into gallery) |
| `/upcoming-event/img_5806/ … /img_5828/` (4 photo posts) | `/media/` |
| `/upcoming-event/summer-break-2/` | `/announcements/summer-break/` |

## Weekly-announcement PDF wrapper posts → one canonical `/announcements/`

The ~45 `wNN_news_chn/eng` posts (each wraps a weekly EN+ZH PDF pair) all redirect to the
announcements index, which lists every week with direct PDF links:

| Old URL pattern | → New URL |
|---|---|
| `/w01_news_chn-4/` … `/w29_news_eng-5/` (all `wNN_news_*` slugs, incl. `-2/-3/-4/-5/-6` suffixes) | `/announcements/` (anchor per week: `/announcements/#w01`, … `/announcements/#w29`) |
| `/2018-10-19/2018-19_week_07_announcement_chinese/` + `_english/` | `/announcements/2018-19-week-07/` (the two spam-infested posts; merge, drop spam) |

## 404s (do not create; ensure new site returns clean 404 or redirects)

| Old URL (404) | → New URL |
|---|---|
| `/registration/signin` | `/register/` |
| `/registration/signin/register` | `/register/` |

## PDF assets (keep stable, no redirect needed if paths preserved)

All `wp-content/uploads/…/*.pdf` URLs stay as-is on the new site (serve from
`/downloads/{name}.pdf` with 301 if you prefer a clean prefix). See `assets.md` §7 for the
full list of 85 + 4 PDFs.
