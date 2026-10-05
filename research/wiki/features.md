# Features of the old site

Every functional feature found in the crawl, with where it lives, how it works, the
plugin/mechanism, importance for the rebuild, and what the new site needs.

> Plugins present (from `pages.jsonl` `plugins` and raw HTML): **Elementor 3.23.4**,
> **Ocean Extra**, **Smart Slider 3**, WordPress core 6.2.13, OceanWP 1.5.28 theme.
> No WPML/Polylang, no WooCommerce, no comment plugin of note (core comments, spammy).

| # | Feature | Where | How it works | Mechanism / plugin | Importance | New site needs |
|---|---------|-------|--------------|--------------------|------------|----------------|
| 1 | **Online registration** (new family / returning) | `/registration/` + home + footer "Portal Sign In" | Landing page links out to external Rails app `register.sandiegochineseschool.com`: `/signin/register` (new), `/signin` (returning). Portal has username/password sign-in, forgot-username/password flows, registration form + payment. 5 public PDFs (Registration Notice EN/ZH, User Guide, Portal Manual, Class Info). | Separate Rails app on subdomain; main site only links to it. | **Must-have** | Keep a registration flow (may rebuild in-house); preserve EN/ZH notices & user guide docs; mail-in no longer accepted (in-person Sep 13 policy for 2026-27) |
| 2 | **Portal sign-in / login** | footer "Portal Sign In", every page footer | Links to `register…/signin`; account-based login with Username/Password, forgot flows | Rails app session auth | **Must-have** | Parent login to view registration status / pay; decide whether to rebuild or keep subdomain |
| 3 | **PayPal donation** | `/sponsors/` | Hosted PayPal `_xclick` button (POST to `paypal.com/cgi-bin/webscr`, hidden `hosted_button_id`); instruction to add name/phone/address for tax receipt | PayPal hosted button | **Should** | Keep a donation path (PayPal or Stripe); tax-deductible receipt note |
| 4 | **Check donation** | `/sponsors/` | Mail check to P.O. Box 910093, San Diego, CA 92191-0093 | mail | **Should** | Keep mailing address for donations |
| 5 | **Google Forms** | `/tcml/` (TCML application), `/ta-program/` (TA application) | External Google Form links: `forms.gle/qpiQZTGVN2zideHd7` (TCML 申請表格), `forms.gle/HmuYPR5RXbAYGsHh9` (TA) | Google Forms (external) | **Should** | Keep application forms (migrate or keep Google Forms) |
| 6 | **Image slider** | home | "Upcoming Event"/program mosaic uses Smart Slider 3 markup (`.ss-` classes) | Smart Slider 3 plugin | **Nice** | A lightweight hero slider or static mosaic |
| 7 | **YouTube embeds / playlist** | home, `/media/`, footer | Links/embeds to `youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx` ("SDCA Cultural Activity Playlist") and channel `UCbURJMa8pWixTD51QEnWMdA` | YouTube (external) | **Should** | Keep video playlist (cultural activities) |
| 8 | **Google Drive photo albums** | `/media/` | "Current School Year Photos" & "Past Photos" link to shared Drive folders (`drive.google.com/drive/folders/…`) | Google Drive (external) | **Should** | Keep photo access (Drive or own gallery) |
| 9 | **Calendar / events list** | home "最新活動佈告欄 Upcoming Event" | Dated list of upcoming events (meetings, exams, contests) rendered on home; school-year calendar as PDF (`2026-27_School_Calendar.pdf`) | static HTML + PDF | **Must-have** | A real events/calendar feature (bilingual dates) |
| 10 | **Scrip (gift-card) program** | `/scrip/` | Explains $50 deposit, $700/$600/$500 refund thresholds, Scrip Days; links 5 PDFs (Program, Schedule, Logos, Form, Transactions) | static page + PDFs | **Should** | Keep scrip info + PDFs |
| 11 | **Newsletter / press mentions** | `/news/`, `/news-archive/` | Curated dated list of press articles (Epoch Times, World Journal, We Chinese, SD Food & Life, OCAC) with external links | static HTML | **Nice** | Keep a news/press section |
| 12 | **Contact form** | `/countact-us/` | **NONE** — only static phone/address/email/SMS info. No email form on old site. | — | **Should** (gap) | Add a real contact form (old site lacks one) |
| 13 | **E-learning / remote learning** | home ("新學年第一學期遠距教學 Remote Learning Fall 2020") | 2020 notice only; no actual e-learning platform found | — | **Unknown** | Confirm if any e-learning exists; likely out of scope |
| 14 | **Facebook** | footer, home | Link `facebook.com/SanDiegoChineseAcademy/` | external | **Nice** | Keep social link |
| 15 | **Search** | top bar (every page) | WordPress core search `<form action="/" method="get"><input name="s">` | WP core | **Nice** | Basic search over pages/announcements |
| 16 | **Comments** | post pages (esp. 2018 W07 posts, `pre-k-program`) | WP core comments; **heavily spam-polluted** (thousands of drug/pharmacy/casino/SEO spam comments on the two oldest posts) | WP core comments | **Drop** | Do NOT carry over comments; disable public commenting |
| 17 | **Scrip / iGive / AmazonSmile / eScrip** | `/sponsors/` | Fundraising shopping links: AmazonSmile `smile.amazon.com/ch/33-0290580` (0.5%), iGive, eScrip | external programs | **Nice** | Keep fundraising shopping links |
| 18 | **Yelp listing** | footer | `yelp.com/biz/san-diego-chinese-academy-san-diego` | external | **Nice** | Keep link |
| 19 | **PTA blog** | footer, `/news-archive/` | `sdcapta.blogspot.com` | external | **Nice** | Keep link (or verify still active) |
| 20 | **Language (bilingual)** | all pages | EN + ZH (Traditional) text side-by-side, **no switcher**, `<html lang=zh-TW>` site-wide | manual authoring | **Must-have** | Proper i18n with EN/繁體 (and optional Simplified) — a real improvement |
| 21 | **PDF document library** | handbook, scrip, registration, class info, calendars, contest rules | ~85 PDFs in `/wp-content/uploads/…` linked from pages & portal | file links | **Must-have** | Re-host all PDFs with clean URLs |
| 22 | **Portal Sign In in footer** | footer | `register…/signin` | external | **Must-have** | Keep parent-portal entry |

## Feature gaps / problems to fix

- **No contact form** on the old site (only static info) → add one.
- **No language switcher** → add proper i18n.
- **Comments spam** → remove commenting entirely.
- **Two "Sponsors" pages** (`/sponsors/` donations vs `/sponsors-2/` logos) → merge into one clear section.
- **Broken registration links** (`/registration/signin`, `/registration/signin/register` → 404 on main domain).
- **Outdated menu PDFs** (2018-19 Textbooks, 2018 Bell Schedule).
- **Outdated 2020 remote-learning & 2020 registration blocks** still on home.
