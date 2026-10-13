# STATE
Goal: rebuild sandiegochineseschool.com. Phases: 1 research (Qwen) -> 2 Claude architecture+spec+build prompts -> 3 Qwen builds -> 4 Claude QA -> 5 push + release "sdca".
Decisions: public repo, Node+SQLite, simple admin.

Phase 1 research DONE (research/wiki). ARCHITECTURE.md + BUILD-PLAN.md written. Phases 0-7 run via work/run_phase.sh N (Qwen); output logs/phaseN.out, work/phaseN-report.md. Phase 0 started 2026-10-05 ~2AM.
Phase 1 DONE+reviewed 3:20AM. Phase 2 (assets/logo/banners) started.
Phase 2 DONE+reviewed 7:06AM (logo traced by Claude scripts/build-logo.py, kit by Qwen). Phase 3 (seed) started.
Phase 3 DONE+reviewed 8:05AM (22 pages, 57 announcements, 81 docs, 13 people, 10 programs, 51 settings; no spam). Phase 4 started.
Phase 4 DONE+reviewed 9:55AM (56 tests). Phase 5 started.
Phase 5 DONE+reviewed 12:45PM (99 tests). Phase 6 (admin) started. Preview worktree ../SDCA-preview on :3100 (tailscale 100.86.110.0:3100) refreshed per phase.
Phase 8 (owner feedback: PDFs new tab inline, section order, hero carousel, footer links/missing pages, content ledger) queued after Phase 6.
Phase 6 DONE+tests 112 pass (1:45PM). Admin demo login in data/ADMIN-DEMO-LOGIN.txt (gitignored). Next: Phase 8 then 7.
Phase 8b (ledger by sha256, photo archive, document archive) started 3:34PM.
Phase 8c (page images: relative-path bug, image parity audit, gaps on about/board/staff etc.) queued: auto-starts after 8b ends.



ROADMAP v3 FAITHFUL REBUILD (2026-10-05): parse old DOM -> verbatim ordered BLOCK TREE -> clean new components; same content/order/layout/images; chain work/run_chain3.sh: Phase 9 (running) -> DP -> 8d -> 8e -> V -> 7 -> release.

## HANDOFF (2026-10-05 5:15PM) — if Claude stops, read AGENTS.md
- Control: `work/ctl.sh status | stop | resume | preview`. Chain `work/run_chain4.sh` is running in the background (survives Claude stopping): DP -> 8d -> 8e -> V -> 7. Resumable; phases skip when work/<phase>-report.md exists.
- Done and committed: research wiki, architecture, design system, assets/logo family, seed, public pages, news/events/docs/search/redirects, admin, phase 8/8b/9. In progress: Phase DP (faithful page rebuild).
- Remaining after chain: Claude-style review gates (see AGENTS.md), docs, push to main + GitHub release sdca v1.0.0.
- Open owner items: review research/CONTENT-LEDGER.md NEEDS OWNER REVIEW; ZH labels translated by Qwen in the menu; ambiguous headshot-to-name matches.

## RESUMED (2026-10-05 06:13PM PDT) → CLAUDE TAKEOVER (owner: "complete the tasks, not just monitor Qwen")
- Qwen chain STOPPED (`work/ctl.sh stop`). Claude is doing DP directly. Chain order preserved: DP → 8d → 8e → V → 7 (V stays with Claude per owner).
- DP DONE except visual review + report: block renderer (11 views/blocks/*.ejs + blocks.css + ported.ejs), import-blocks.js (24 pages in pages.blocks), 7 hand-written block files, repair-blocks.js (class levels, inline-link maps, merges), parity.js **24/24 PASS** (research/PARITY.md), tests/parity.test.js, **npm test 128 pass 0 fail**, CONTENT-LEDGER DP addendum (DP-1..DP-11), redirects + sitemap updated, migration 006 (body_source).
- Visual review IN PROGRESS: work/shots/ has 72 shots (24 routes × EN1280/EN375/ZH1280). Viewed: en-about, en-about-board. Next: view rest, fix defects, write work/phaseDP-report.md, then 8d.
- Dev server: detached on :3100 (RATE_LIMIT=5000, /tmp/sdca-dev.log). Preview snapshot dir is stale; :3100 serves live repo.
- Known: `work/ctl.sh preview` hangs the shell — re-sync + restart manually, never via ctl preview.
- Qwen chain RESUMED via `work/ctl.sh resume` (qwen + chain RUNNING). Phase DP continues from `work/phaseDP-log.md` (283 tool calls).
- Preview server on :3100 is up (detached, PID owned by init) but a STALE snapshot — re-sync + restart it after DP finishes before visual review.
- Phase DP (faithful page rebuild) is IN PROGRESS: 283 tool calls at resume. Uncommitted changes are in `research/blocks/*.json` and `tests/db.test.js`, plus untracked PDFs under `storage/uploads/`. Last known mid-DP test result: 124 pass, 1 FAIL.
- NOT done yet: DP, 8d (original menu), 8e (hero 5 slides), V (visual/spacing QA incl. events page whitespace), 7 (hardening, launchd service, docs), final review, push to main + GitHub release sdca v1.0.0.
- Was STOPPED CLEANLY 06:11PM, RESUMED 06:13PM. Preview snapshot refresh: do NOT use `work/ctl.sh preview` (hangs the shell) — re-sync + restart manually.


## 2026-10-12/13 — SCHOOL PORTAL BUILT (Claude, no Qwen — owner's instruction)
- **What:** the old register.sandiegochineseschool.com rebuilt as part of this site at `/en|zh/portal`: sign in, new family, invitations, forgot username/password, family home, add child/parent, registration wizard (select → waiver → fee form → print), payments (check/cash only), receipts, volunteer sign-up, credit-student school info, credit grades, class lists, placement, reports/CSV, **one fee page per school year** (`/portal/fees`), roles & permissions (Admin only), ~35 management pages (list + search + filter + sort + page + CRUD + CSV) generated from `src/portal/entities.js`.
- **Docs:** `research/portal/FEATURES.md` (what the old portal does, from the 28 screenshots + 3 PDFs), `research/portal/DATA-MODEL.md` (design). Code: `src/portal/*`, `views/portal-app/*`, `db/migrations/007_portal.sql` (43 tables, every row has id/created_at/updated_at/created_by/updated_by/deleted_at), `scripts/portal-seed.js`.
- **Run:** launchd service `com.sdca.web` (`~/Library/LaunchAgents/com.sdca.web.plist`, KeepAlive) serves http://0.0.0.0:3100 → Tailscale http://100.86.110.0:3100/en/portal/signin. SQLite `data/sdca.db` (WAL). Logs `logs/web.{out,err}.log`. Restart after code/template changes: `launchctl kickstart -k gui/$(id -u)/com.sdca.web`.
- **Demo data:** `npm run portal:demo` wipes portal tables and loads 40 INVENTED families + 12 teachers + staff + classes + 2025-26/2026-27 registrations, payments, volunteers, credit grades. Logins are in `data/PORTAL-DEMO-LOGINS.txt` (git-ignored, random passwords). `npm run portal:seed` = reference data only (safe, idempotent).
- **Tests:** `tests/portal.test.js` (16) — permissions, registration → payment → placement, fees, roles matrix, CSRF, lockout, invitations, password reset. `node scripts/portal-smoke.js` signs in as every role and fetches its pages. `npm test`: 143 pass, 1 fail (old parity test: Board image + Volunteer text).
- **Rules decided with owner:** no online payments (check/cash only); all fees configurable per year by staff; student login sees only own school/class/teacher/credit grades (never classmates); emails are logged to an outbox (demo) until SMTP is chosen; GitHub Pages copy cannot run the portal (only the 5 static portal pages are published there).
- **Real data later:** do NOT put real family data in until hosting/security is decided (HTTPS, backups, real SMTP, password policy review). A CSV import for the old "Student List"/people exports is not written yet.
- **Known gaps / next:** attendance, announcements to a class, document uploads (withdrawal form), duplicate-family merge tool, email sending (SMTP), 2FA for staff, PDF roster (browser print-to-PDF today), import of real data, admin UI polish on very wide tables.

## Portal update (2026-10-13)
- Menu: Home, Profile, Account (incl. Change User Name), Billing, Resources (landing pages `/portal/profile|account|billing|resources`), staff groups, Sign Out last.
- Student List / Volunteer List (read-only list views `v_student_list`, `v_volunteer_list`, migration 008) replace the old CSV buttons; Class Roster is its own sortable page; Reports & Exports only links to lists.
- Lists: default columns per entity (`defaultCols`), per-browser column picker, expandable rows, sticky first column, no actions column (edit/delete on the record page), instant filters (no Apply), one-row toolbar. All UI shows one language at a time.
- Brand: accent/blue #210488 everywhere; logo is the blue shield with no box; favicons regenerated.
- Demo logins: password = username; parent-only `demo.parent01..31`; multi-role `demo.parentsecretary|parentvolunteer|parentteacher1-3|parentroomparent1-4`.
- Fixed: lang switch keeps the page; sign-in with unknown user no longer errors (verifyPassword length check).
