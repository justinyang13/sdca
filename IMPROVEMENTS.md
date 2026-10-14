# SDCA — project review and improvement plan

Review date: 2026-10-13. Scope: the whole repo (public site, `/admin`, school portal, database, scripts, tests, hosting).
Method: measured the code (size, coverage, SQL/index audit, `npm audit`), read the auth, session, upload, email, CRUD and reporting code, and checked the running service. Findings are ordered by what matters most. Effort: S = under half a day, M = 1–2 days, L = several days.

**Snapshot.** About 5,700 lines of server code (public site 1.9k, portal 3.0k, old admin 0.8k) plus about 3.6k lines of page templates, 5.5k lines of one-off scripts, 149 tests (148 pass; the "parity" test has been red for a long time), 0 vulnerable dependencies, page responses 3–17 ms locally. The architecture is sound: a declarative entity registry (`entities.js`) drives list, search, filter, CRUD, CSV and permissions for about 45 tables. The weak points are operations, security hardening for a public link, one duplicated admin system, and database constraints.

---

## 1. Fix first — the site is public now (Funnel)

| # | Finding | Why it matters | Fix | Effort |
|---|---|---|---|---|
| 1 | **No `SESSION_SECRET` is set** (launchd has none); the code falls back to a default that is in the public repo (`config.js`, and a *second* different default in `middleware/index.js`). | Session cookies are signed with a publicly known key. Ids are random so it is not directly exploitable, but it is the wrong default. | Generate a secret once, keep it in `data/.session-secret` or the launchd env; **refuse to start in production without it**; one source of truth. | S |
| 2 | **Demo email mode prints the password-reset link on the page** (`PORTAL_EMAIL_MODE` defaults to demo). | Anyone can request a reset for any username and see the link; the only second step is the family phone number. Fine for fake data, **not acceptable with real families.** | Default to "no link shown" unless `NODE_ENV!=='production'` or an explicit `PORTAL_DEMO=1`. Send real email (see 4.1). | S |
| 3 | **Contact form** has no CSRF check and no rate limit (only a honeypot). | Spam and abuse once public. | Add a per-IP limiter, an origin check and a minimum fill time. | S |
| 4 | **Login lockout is per username only.** | An attacker can lock any parent out by guessing wrong 5 times; no per-IP throttle on the phone-verification step. | Per-IP + per-user limits, escalating delay, a notice email on lockout. | S |
| 5 | **No backups.** One SQLite file on one Mac. | A disk failure loses everything. | Nightly `VACUUM INTO` copy with 30-day retention, copied off the Mac (iCloud or a bucket); a restore test; document it in `RUNBOOK.md`. | S |
| 6 | **Weak demo passwords** (`secret-<name>`) and `demo.admin` are reachable from the internet. | A stranger can wipe or change the demo. | Keep the public demo read-mostly: a nightly "reset demo" job, or restrict `demo.admin` to tailnet. | S |
| 7 | **No log rotation or uptime check.** | A full disk or a crash goes unnoticed. | `newsyslog`/size-capped logs; an external ping on `/health`. | S |

## 2. Database

1. **49 foreign-key columns have no index** (43 portal tables, 23 indexes). Lists and the family/registration pages will slow down as data grows. Add one migration with the obvious ones: `enrollments(student_person_id, school_year_id)`, `enrollments(school_class_id)`, `registrations(family_id, school_year_id)`, `transactions(family_id, transaction_date)`, `family_members(person_id)`, `user_roles(user_id)`, `role_permissions(permission_id)`, `volunteer_signups(person_id, school_year_id)`, `class_assignments(person_id)`. (S)
2. **Rules enforced only in code.** Move into the database: a family has at most two parents (partial unique index on `family_members(family_id, relationship)` for `parent_one`/`parent_two`); one enrollment per student per year; exactly one current school year (partial unique index). (S)
3. **Soft delete vs UNIQUE.** A deleted row still holds its username/code. Use partial unique indexes `WHERE deleted_at IS NULL`. (S)
4. **Grade stored as a bilingual string** (`'三年級(3rd Grade)'`) and the UI has to parse it (`gl()`). Store the grade number (and class-type) and derive the label per language. Same for any concatenated labels. (M)
5. **Date/time formats are mixed** (`YYYY-MM-DD`, `YYYY-MM-DD HH:MM`, `…:SS`, ISO). We already hit one timezone bug (date-only strings parsed as UTC). Store timestamps as ISO-8601 UTC, all-day events as plain dates, and keep a school timezone setting instead of relying on the server's zone. (M)
6. **Student/volunteer list views** (`v_student_list`) join `family_members`; a child in two families would appear twice. Pick the primary family explicitly. (S)
7. **Two user tables** (`admin_users` for `/admin`, `users` for the portal). See 3.1.
8. **Audit log** grows without limit and stores whole before/after rows. Add a retention job and a per-record "history" tab in the edit page. (M)
9. Add a **schema/integrity test** (foreign-key check, migrations apply on an empty DB, a restore from backup) so database changes are safe. (S)
10. Later (≥10k people): full-text search for people; today `LIKE '%x%'` is fine.

## 3. Code and architecture

1. **Retire the old `/admin` and fold it into the portal.** `src/admin/routes.js` (739 lines, inline SQL, hard deletes, its own login, 54% covered) duplicates what the entity engine already does. Add announcements, events, pages, programs, people, sponsors, documents, media as entities with a "Website editor" role. Result: one login, one session/timeout, one audit trail, soft delete with restore, and about 700 fewer lines. (L, high value)
2. **Shared portal helpers.** `go`, `forbidden`, `staffCan`, `s()` are re-declared in 10 route files. Move to `portal/util.js`. (S)
3. **Data-access layer.** Dashboards and reports run long SQL inside route handlers (`r-home.js`, `r-people.js`, `r-finance.js`). Move queries into `portal/repo/*.js` so they are testable and reusable (the billing balance logic is already duplicated between pages). (M)
4. **Template cost.** `renderPart` reads the template file from disk on every call and re-parses the image manifest per request; fine at today's traffic, wasteful later. Cache compiled templates in production (EJS `cache`), load the manifest once. (S)
5. **Cache-busting by hand.** 23 `?v=` numbers in `main.ejs` are bumped manually (I did it many times). Add an `asset()` helper that appends a content hash. (S)
6. **i18n.** 507 inline `b('English','中文')` calls beside a `t()` dictionary. Keep inline for now, but add a test that every label has both languages, and plan to move strings into message files before adding a third language. (M)
7. **CSS.** Files are named by phase (`phase5.css`, old static `portal.css`) and `portal-app.css` has grown by appending. Reorganise into `base / components / site / portal`, delete dead rules, single token file. (M)
8. **Scripts.** 5.5k lines, mostly one-off scraping/import tools for the old site. Move to `tools/legacy-import/` and keep `scripts/` for operations (seed, backup, import calendar). (S)
9. **Quality gates.** No CI, no linter, no formatter, no `.nvmrc`. Add GitHub Actions (install, `npm test`, portal smoke), ESLint + Prettier, and pin Node (the app uses `node:sqlite`, which is still experimental). (S–M)
10. **Tests.** *(Money handling done 2026-10-13: `tests/finance.test.js`, 26 tests; found and fixed the refund bug and the missing thousands separator — see below.)* The parity test has failed for a long time; either fix the two pages (Board image, Volunteer text) or mark it informational, so a red build means something. Raise coverage where money moves: `r-finance` 51% (void, refund, withdrawal), `r-people` 55%, hubs 41%. (M)
11. **Repo weight.** `.git` is 253 MB because 279 MB of images were committed. Convert images to WebP/AVIF, move originals to `storage/` or Git LFS, and keep the repo light for hosting and CI. (M)

## 4. Features worth adding (by value to the school)

1. **Real email** (SMTP or a service such as Resend): registration confirmation, payment receipt, password reset, invitations; a queue with retries and an outbox viewer (the outbox table already exists). Required before real data. (M)
2. **Re-registration flow** — *done 2026-10-13 (see progress log)*; still open: early-bird countdown. (M)
3. **Class announcements and messaging:** teachers and room parents post to their class; parents get a digest; weekly announcement published from the portal (today a PDF upload). (M)
4. **Attendance and absence reporting:** teachers mark, parents see; reports per class. (M)
5. **Finance tools:** daily deposit report, unpaid-registration aging, service-fee refund workflow (`service_fee_refunded_at` exists but has no screen), scrip tracking, year-end summary, Excel export. (M)
6. **Class capacity, waitlist and class-change requests** with the calendar's deadlines. (M)
7. **Volunteer hours** and a "sign-off" step for teachers/PTA. (S–M)
8. **Credit-class report cards** (printable PDF/transcript) and a gradebook for teachers. (M)
9. **Duplicate-family detector/merge** and a **CSV import with preview** for moving the old system's data in. (M)
10. **Student store / coupon day orders** (they appear on the calendar): a small order module. (M)
11. **Calendar feeds:** one subscribe-able `.ics` for the whole school year (Google/Apple), plus per-event reminders by email. (S)
12. **Security features for staff:** two-factor sign-in (TOTP), "sign out everywhere", session list, admin IP allow-list. (M)
13. **Privacy:** a documented data-retention policy, a "download / delete my family data" action, photo-consent reporting. (M)
14. **Online payments** (when the board agrees): Stripe or similar behind the existing payment-method model; receipts as PDF. (L)

## 5. UX improvements

- **Parent home as a to-do dashboard:** "Register for 2027-28", "Sign the waiver", "Volunteer sign-up", "Balance due", plus next three events and the latest weekly announcement. Today it is a dense data page. (M)
- **Registration wizard:** save a draft and resume, always-visible fee estimate, a clear "what happens next" page, confirmation email. (M)
- **Tables on phones:** below ~700 px show each row as a card; remember column choices in the account, not only the browser; bulk actions (select rows → export / message). (M)
- **Global search** for staff (`/` or ⌘K): people, families, classes. (M)
- **Trash and undo:** soft delete exists but there is no "restore" screen; add a Trash page per entity and an undo toast. Replace `window.confirm` with an accessible dialog. (M)
- **Forms:** inline field errors with an error summary, input masks for phone/date, consistent required markers. (M)
- **Accessibility pass:** run axe on the main flows; check focus handling in the collapsible side menu, `aria-sort` on sortable headers, table captions, colour contrast of the blue accent on tinted backgrounds, and screen-reader text for the expand arrows. Only 2 `img` tags lack `alt`; the rest is good. (M)
- **Public site:** the weekly PDF viewer should fall back to a link on iPhone (partly done); add Lighthouse targets (image sizes are the main cost); consistent bilingual page titles. (S–M)
- **First-login help:** a short guided tour or "how do I…" card per role; link the Portal User Manual PDF where relevant. (S)

## 6. Hosting and operations (before real family data)

- Move from the Mac to a small always-on host (a VPS or Fly/Render with a volume). Use Litestream or the nightly copy for backups, a real domain with HTTPS, a staging copy, and an uptime monitor.
- Keep one environment file per environment (`.env.example` exists), no secrets in the repo, and document the restore procedure in `RUNBOOK.md`.
- Decide data ownership and who can see what (board, principal, secretary) before import; run the privacy review (item 4.13).

## 7. Suggested order

1. **Week 1 — safe to share:** items 1.1–1.7, database indexes and constraints (2.1–2.3), CI + lint + Node pin (3.9), fix or demote the parity test (3.10).
2. **Weeks 2–3 — consolidate:** retire `/admin` into the entity engine (3.1), shared helpers and data layer (3.2–3.3), template/asset caching (3.4–3.5), image diet (3.11).
3. **Weeks 3–5 — parents and staff:** real email (4.1), parent dashboard + re-registration (5, 4.2), class announcements (4.3), phone-friendly tables, trash/undo.
4. **Then:** finance tools, attendance, report cards, import/merge tools, staff 2FA, hosting move.

None of the above has been changed in the code; this file is the only addition.

## 8. Progress log

- **2026-10-13 — money handling tests.** Added `tests/finance.test.js` (26 tests, 100% of the finance routes' paths for payments, voids, withdrawals/refunds, manual scrip transactions, receipts/billing access, fee maths). It found two real defects, both fixed: (1) a withdrawal refund was **added** to the amount paid instead of subtracted (a refunded registration looked more paid); the "paid" calculation now lives in one place, `src/portal/money.js`, and is used by the payment form, the void logic and the Billing page; (2) `money()` did not print thousands separators (`$1130.50` → `$1,130.50`). Mutation check: breaking the sign rule makes 4 of the new tests fail.
- **2026-10-13 — shared helpers and cache busting (3.2, 3.5 done).** `src/portal/util.js` now holds `s`, `dollars`, `num`, `today` and `portalHelpers(page)` (`lang`, `P`, `go`, `forbidden`, `staffCan`); the ten route modules no longer carry their own copies (about 40 duplicate lines removed; the two slightly different `dollars` versions are now one). `src/asset-version.js` adds `asset('/css/x.css')` → `?v=<content hash>`; all 30 hand-written `?v=N` numbers in the layouts, header, footer, portal shell and admin layout were replaced, files requested with a hash are cached for a year (`immutable`), and nothing needs bumping any more. Tests: `tests/asset-version.test.js`.
- **2026-10-13 — re-registration (4.2).** Parents see "Re-register For 2027-2028 School Year" once staff switch *registration open* on for that year (Fees page); both the current and the next year can be open at once. The wizard (`/families/:id/register?year=<id>`) now registers for the chosen open year and, when the family has history, pre-fills: students ticked (graduates — grade 12 last year — are shown but not ticked), same class type (preschool → regular), next grade, the first three volunteer choices, and copies last year's regular-school info (grade + 1) when the draft is created; a banner asks the parent to review the family contact data. Nothing is submitted for them. Code: `src/portal/rereg.js`; tests: `tests/rereg.test.js` (8). The demo has 2027-2028 open so it can be tried (turn it off in Fees).
- **2026-10-13 — dates/times, indexes, board roles, slides, announcements, class announcements, finance reports.**
  - *Dates and times (2.5):* `src/datetime.js` + migration 011 + `ARCHITECTURE.md → Dates and times`; school time zone for "today", UTC moments shown in school time, one display style per place, iCal export fixed (all-day multi-day events, real UTC instants). `tests/datetime.test.js`.
  - *Indexes (2.1):* migrations 010 and 015 (about 45 indexes, every busy foreign key); `tests/features.test.js` checks them with EXPLAIN QUERY PLAN. (The unique rule "one enrollment per student per year" already existed.)
  - *Board:* `board_positions` (the nine titles of the public Board page) and `board_members` (term) → `syncBoardRoles` grants/revokes the position's portal role; nine board roles + nine demo logins; every role has its own "<Role> Resources" block on the landing page (`src/portal/resources.js`).
  - *Hero slides:* migration 013 turns the three hard-coded slides into records (title, description, image, link, optional 2nd button; layouts photo / feature / intro); Staff Tools → Hero Slides with image upload; the seed no longer overwrites them.
  - *Public announcements:* Staff Tools → Public Announcements (kind, text, attached PDF upload, pin, publish); public pages and search follow.
  - *Class announcements:* teachers / room parents post to their classes, parents and students read them, optional e-mail to the class families (outbox).
  - *Finance reports:* daily deposit, unpaid registrations (aging), year summary, scrip — HTML, print and CSV; permission `finance.reports`.
  - *Menus:* Enter Payment → Finance (group renamed from Fees & Payments), Class Placement and Class Roster → Classes & Students, Rooms → School (group renamed from School Setup).

