# SDCA SPEC (San Diego Chinese Academy website rebuild)
## BRD
- Goal: replace https://sandiegochineseschool.com/ (WordPress) with a top-tier, clean, enterprise-grade site for San Diego Chinese Academy 聖地牙哥中華學苑, a non-profit Chinese language school (since 1988).
- Audience: parents, students, teachers, volunteers, donors; bilingual English / Traditional Chinese (繁體), Simplified optional.
- Must keep: all real classroom photos, the logo identity (may be modernized/redrawn but recognizably the same), every feature of the old site.
- Public GitHub repo justinyang13/sdca; release as new project "sdca".
- Rule: built entirely by local Qwen; Claude kicks off, architects, and quality-gates.
## FRD  (written after research, see research/)
## TRD  (written after research by Claude: architecture.md)
- Node app + SQLite (better-sqlite3 or node:sqlite), simple staff admin for news/events/classes.

## CONTENT PRESERVATION RULE (owner rule, 2026-10-05) — applies to EVERY phase and every future change
Presentation may be redesigned freely (layout, cards, galleries, typography), BUT for every old page its CONTENT AND ORDER MUST BE PRESERVED: all text (EN and ZH), all images/photos with their captions, all PDFs/links/embeds/forms, and the ORDER of sections/items as on the old page (e.g. the order of board members, staff, programs, announcements, sponsors, FAQs, list items, photo sequence). Nothing may be dropped, merged away, shortened or reordered. If something cannot be placed, add it to research/CONTENT-LEDGER.md under NEEDS OWNER REVIEW instead of silently omitting it. Every phase report must state how this rule was verified (content-audit + image-parity + order check). Add an ORDER CHECK to scripts/content-audit.js: for each old page, the sequence of its headings and of its content images/links must appear in the same relative order on the new page (report any inversions).

## FRD — School Portal (2026-10-13)
Source of truth: `research/portal/FEATURES.md` (old portal inventory) and `research/portal/DATA-MODEL.md` (data model). Acceptance criteria are executable in `tests/portal.test.js`.
1. **Users & roles:** Staff (Admin, Principal, Secretary/Registrar, Accountant, Teacher, PTA/Volunteer Coordinator), Parent, Room Parent, Volunteer, Student (credit class). A person can hold several roles. Each role has its own landing page; permissions are enforced on the server for every route.
2. **Role & Permission management** is Admin-only (`roles.manage`).
3. **Every entity** has a management page (list with search, filters, sort, paging, CSV export; create/edit/soft-delete) when the role has the permission; every table carries id, created/updated at+by, deleted_at; changes are audited.
4. **Registration:** parent selects children → waiver(s) → itemised fee form (printable) → pays by check/cash at the office → staff records the payment (parent sees it in Transaction History, can print the receipt with tax ID) → staff place students into classes (parents see class/room/teacher one week before school).
5. **Fees:** all amounts, dates, discounts and the withdrawal-fee schedule are data, edited per school year in one page.
6. **Student login:** own school, class, teacher(s), middle/high-school info and published credit grades only — never classmates.
7. **Volunteers:** up to three prioritised jobs or "I cannot volunteer"; PTA assigns; CSV export.
8. Out of scope for now: online card payments, SMS, real-family data import, attendance.

## TRD — School Portal
Node 26 + Express 5 + EJS + `node:sqlite` (WAL, FKs on) · code in `src/portal/` (entities.js drives generic CRUD; perm.js roles/permissions; fees.js pricing; r-*.js routes) · views `views/portal-app/` · migration `007_portal.sql` · sessions in SQLite via a real express-session store · passwords scrypt (8+ chars), 5-failure lockout (15 min), CSRF double-submit on every POST, helmet CSP, server-side authorization + family/class scoping · runs as launchd service `com.sdca.web` on port 3100.

