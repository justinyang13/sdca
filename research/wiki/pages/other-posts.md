# Other Posts (events, PDFs, calendars, contests, photos)

Beyond the weekly announcements, the old site uses **blog posts** as a general-purpose
content vehicle: single-image posters, PDF wrapper posts, calendar posts, contest
announcements, event photo dumps, and screenshots. All are 200-status pages in the
crawl. This file lists them all.

## A. Event / announcement posts

| URL slug | Title | Content type | Key asset(s) |
|----------|-------|--------------|--------------|
| `2018/10/22/pre-k-program` | Pre-K Program | Pre-K program intro + **3,791 spam comments** (ignore) | `Pre-K-Intro-2016.pdf` |
| `2026-first-day-of-school-2` | 2026 First Day of School | photo | `2026-First-Day-of-School-1.jpg` |
| `2026-2027-first-day-of-school` | 2026-2027 First Day of School | photo | `2026-2027-First-Day-of-School.jpg` |
| `upcoming-event/summer-break-2` | summer break | photo | `summer-break.jpeg` |
| `dinner-3` | Dinner | photo (teacher appreciation dinner) | `Dinner-scaled.jpg` |
| `2025-2026-…38週年校慶暨春節園遊會program_guide` | 2025-2026 聖地牙哥中華學苑38週年校慶暨春節園遊會 program_guide | event guide (38th anniversary + CNY carnival) | `2025-2026-…program_guide.pdf` (1,297,202 B) |
| `2026-pre-registration` | 2026 Pre-registration | poster (GIF) | `2026-Pre-registration.gif` |
| `2026-hoc-essay-english-announcement` | 2026 HOC Essay English Announcement | contest notice | `2026-HOC-Essay-English-Announcement.pdf` (198,584 B) |
| `2026-essay-application` | 2026 Essay Application | application | `2026-Essay-Application.pdf` (199,576 B) |
| `sample-page/2026-essay-ad` | 2026 essay ad | ad image | `2026-essay-ad.png` |
| `2025-26_sdca_作文比賽辦法` | 2025-26_SDCA_作文比賽辦法 | essay contest rules | `2025-26_SDCA_作文比賽辦法.pdf` (135,700 B) |
| `2026-中國館中文比賽通知` | 2026 中國館中文比賽通知 | contest notice | `2026-中國館中文比賽通知.pdf` (174,676 B) |
| `2025-2026-詩詞朗誦比賽規則及詩詞` (and `-2` dup) | 2025-2026 詩詞朗誦比賽規則及詩詞 | poetry recitation rules + poems | `2025-2026-…詩詞朗誦.pdf` (764,095 B) |
| `sdca-yearbook-cover-art-contest-guidelines-2025-2026` | SDCA Yearbook Cover Art Contest Guidelines 2025-2026 | contest guidelines | `SDCA-Yearbook-Cover-Art-Contest-Guidelines-2025-2026.pdf` (165,633 B) |
| `2020/Announcement/98255_2021_新春創意活動徵稿` | 2021 新春創意活動徵稿 (New Year creative activity call) | announcement | `98255_2021_…徵稿.pdf` (180,019 B) |

## B. Calendar / schedule posts (PDF wrappers)

| URL slug | Title | PDF (local) |
|----------|-------|-------------|
| `2026-27_school_calendar` | 2026-27_School_Calendar | `2026-27_School_Calendar.pdf` (590,908 B) |
| `2026-27_school_calendar-2` | 2026-27_School_Calendar (dup slug) | same PDF |
| `2025-2026_school_calendar-03152026` | 2025-2026_School_Calendar 03152026 | `2025-2026_School_Calendar-03152026.pdf` (634,143 B) |
| `2026_2027_classroom-map` | 2026_2027_Classroom Map | `2026_2027_Classroom-Map.pdf` (657,569 B) |
| `student-store-schedule` | Student Store Schedule | `Student-Store-Schedule.pdf` (325,373 B) |
| `2026-上課時間表` (`2026-_E4_B8_AD_…`) | 2026 上課時間表 (class schedule) | `2026-上課時間表.pdf` (174,676 B — same size as 中國館通知, verify) |

## C. Photo-dump posts (`IMG_NNNN` slugs)

These are single-photo posts (likely auto-published event photos). Each carries one
image (the slug matches the photo filename).

| Slug | Image (local) |
|------|---------------|
| `img_8989` / `img_8988` / `img_8987` / `img_8986` | `IMG_8986-8989.jpg` (also `.{hash}` dup variants) |
| `upcoming-event/img_5828` … `img_5806` | `IMG_5806/5811/5817/5827/5828.*` |
| `img_5356` … `img_5351` | `IMG_5351-5356.*` |
| `img_4607` | `IMG_4607.*` |
| `img_4223` … `img_4215` | `IMG_4215/4216/4219/4223.*` |
| `img_4117` / `img_4108` | `IMG_4108/4117.*` |
| `img_2892` … `img_2885` | `IMG_2885/2889/2891/2892.*` |
| `screenshot` / `screenshot-2` / `screenshot-3` | `IMG_4190.jpg`, other screenshots |
| `adult` | `Adult.jpg` |
| `bod` | `BOD.jpg` |

## D. Other single-image pages

| Slug | Title | Image |
|------|-------|-------|
| `sdca-ad-half-page` | SDCA Ad -half page | `SDCA-Ad-half-page.jpg` |
| `new-student-advertisments-2026` | New student Advertisments 2026 | `New-student-Advertisments-2026-scaled.jpg` |
| `吉他的` (`%E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1`) | 吉他海報 | (guitar poster image) |
| `2018/10/19/2018-19_week_07_…` | (see weekly-announcements.md) | — |

## Notes for the new site

- **None of these posts carry meaningful HTML body text** in the crawl — the content
  is either a single image or an attached PDF. The new site should model them as
  **announcements with a title, date, one image, and zero-or-more PDF attachments**
  (see `content-model.md`).
- The `IMG_NNNN` / `screenshot` / `dinner` posts are candidates for consolidation
  into a proper **media gallery** or **event** entity rather than standalone URLs.
- Several slugs are accidental duplicates (`-2`, `-3`, `-4` suffixes) — consolidate
  via 301 redirects (see `url-map.md`).
- The 2018-19 W07 posts and `pre-k-program` post are **comment-spam polluted** —
  do not import their comment data.
