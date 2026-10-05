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


ROADMAP v3 DIRECT PORT (2026-10-05): after Phase 9 (running) -> DP (port every old page 1:1 verbatim into new layout) -> 8d menu -> 8e hero -> V visual QA -> 7 hardening -> release. Chain: work/run_chain3.sh. 8g/8f/S1-S4 cancelled.
