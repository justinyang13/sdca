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

