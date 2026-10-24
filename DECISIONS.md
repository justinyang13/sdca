# DECISIONS
- 2026-10-05: repo public (justinyang13/sdca); Node + SQLite; simple staff admin; Qwen builds everything, Claude architects/QA.
- 2026-10-05: demo hosted from the user's Mac over Tailscale (no cloud hosting yet); Node app must bind 0.0.0.0, run under a launchd/pm2-style service, and be reachable at the Tailscale address.
- 2026-10-05: user supplied design mockup (design/INSPIRATION.md); no AI-generated people, only real photos for faces; local image-gen OK for non-people banners.
- 2026-10-05: user: save Claude tokens, push as much as possible to local Qwen (research, wiki, code, content, QA drafts). Claude only specs, spot-checks, architecture. Keep chat updates minimal.
- 2026-10-05: stack decided: Express5+EJS+node:sqlite, no React; plan in ARCHITECTURE.md/BUILD-PLAN.md
- 2026-10-05: logo family: public/brand/logo-1-badge, logo-2-badge-name, logo-3-full (+ -dark); built by scripts/build-logo-parts.py. Header: full >=1280px, compact 600-1279, badge <600.
- 2026-10-05: owner feedback round 1 -> BUILD-PLAN Phase 8. All content must be preserved; unplaced items go to research/CONTENT-LEDGER.md for owner review.
- 2026-10-05: owner: images missing on footer pages -> Phase 8c. Claude must visually QA every page after each phase.
- 2026-10-05: OWNER RULE: layout may change, but content, images and ORDER of every old page must be preserved (BUILD-PLAN.md top, ARCHITECTURE.md, SPEC.md).
- 2026-10-05: OWNER RULE: header menu + sub-items must match the OLD site exactly (labels, order); Phase 8d restores it, runs after 8c.
- 2026-10-05: owner found disclaimer text differs: seed paraphrased pages. Phase 8f = deterministic verbatim HTML->Markdown import + strict text-fidelity test.
- 2026-10-05: owner asked for full re-crawl: Phase 8g, output research/v2.
- 2026-10-05: ROADMAP v2: capture once (crawl v2) -> deterministic import -> strict parity tests -> section-by-section passes vs old screenshots -> menu/hero -> hardening.
- 2026-10-05: owner: simple 1:1 project. ROADMAP v3 Direct Port replaces capture/section passes: reuse old main-content HTML verbatim in new layout.
- 2026-10-05: clarified: NOT reuse old HTML; rebuild clean HTML with same content, order, layout arrangement and images (block-tree parser + renderer).

## 2026-10-13 — School portal (owner decisions)
- Build it ourselves in this repo (Node + SQLite), no Qwen; same site style; all old portal screens rebuilt and wired up.
- No online payments for now: check or cash only. Fees are configured by staff per school year in one place.
- Student login (credit students only) sees their own school, class, teacher and credit grades; no classmates.
- Emails are logged to an outbox until a real sender is chosen. Hosting stays on this Mac (launchd + Tailscale) for now; revisit later.
- Real family data is NOT loaded; demo uses invented families. Screenshots of the old portal stay out of git (research/SDCA Portal/ is ignored).

## 2026-10-24 — Chatbot (src/chat)
- Chatbot: local RAG. Content (FAQ, pages, events, announcements) is indexed in memory at startup (FTS5); each question retrieves a few passages and sends only those to qwen3.8:27b via Ollama. Layers: widget → /api/chat → orchestrator → sources + model adapter.
- Chinese is Traditional only. The old site is Traditional (zh-TW); Simplified input is not supported (no conversion). Eval question for it removed.
- Eval: `node scripts/chat-eval.js` (49 questions in tests/chat-eval/questions.json; event questions expire as dates pass).

## 2026-10-24 — Demo data vs live data (option B)
- Two database files: `data/sdca.db` = LIVE (real site content, no demo people/classes/fees), `data/demo.db` = DEMO (full copy with the invented portal data). `DATASET=demo` selects demo (`npm run start:demo` on port 3300; `npm run demo:seed` rebuilds it). Default is live.
- `is_demo` flag (migration 018) on persons, users, families, school_classes, rooms, board_members, fee_schedules, textbooks. The demo seed flags everything it creates; a live DB with any `is_demo=1` row, or a DB/DATASET mismatch, refuses to start (src/db/guard.js). The demo seed refuses to run against the live file. Placeholder fees are no longer seeded into live.
- Public features (chatbot) read only `v_public_*` views, which filter out demo rows; `tests/datasets.test.js` enforces it.
- One-time split done with `scripts/split-datasets.js` (backup: data/backups/, git-ignored). Real data (board, classes, rooms, fees) is still to be entered or backfilled into live.

## 2026-10-24 — Real data backfilled into live (scripts/backfill-real-data.js, idempotent)
- Board (9), rooms (22) and 2026-27 classes (18) from the Board page and the 2026-27 classroom map (checked on the rendered page image); fees and withdrawal schedule from `reg-notice.pdf` (2026-27 Registration Notice; it has no scrip-deposit line, so none entered). Persons for board members carry a placeholder gender (not recorded). Teachers, capacities and textbooks are NOT loaded (no current source).
- Events already matched `2026-27-school-calendar.pdf` (84 calendar rows vs 75 active events, multi-day breaks merged); removed the stray admin "Test" event (soft delete).
- Chat ignores PDFs about earlier school years (year detected from the text; scripts/extract-pdfs.py). Old registration notices (2019-20, 2020-21) had different tuition. Bump `CURRENT_YEAR_START` in src/chat/sources.js each July.

## 2026-10-24 — Refactor (steps 1–6)
- One render service (src/web/render.js) for public pages; routes import it instead of receiving a bridge object. Routes renamed by feature: routes-pages.js, routes-content.js.
- Admin content screens are declared in src/admin/entities.js and built by src/admin/crud.js. Delete is now a soft delete (deleted_at) for events, slides and announcements (their public queries already hide deleted rows); other tables are still removed.
- Repeated SQL lives in src/queries/*.js (named queries). Shared helpers: sanitize.js, auth/lockout.js, school.js (office contact from settings), i18n pickLang/localized (also available in templates).
- Tests: tests/support/portalApp.js and adminApp.js replace per-file boot code. Known failing check: parity (3 pages differ from the old site: about-board image, parents-volunteer text, enroll links).
