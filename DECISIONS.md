# DECISIONS
- 2026-10-05: repo public (justinyang13/sdca); Node + SQLite; simple staff admin; Qwen builds everything, Claude architects/QA.
- 2026-10-05: demo hosted from the user's Mac over Tailscale (no cloud hosting yet); Node app must bind 0.0.0.0, run under a launchd/pm2-style service, and be reachable at the Tailscale address.
- 2026-10-05: user supplied design mockup (design/INSPIRATION.md); no AI-generated people, only real photos for faces; local image-gen OK for non-people banners.
- 2026-10-05: user: save Claude tokens, push as much as possible to local Qwen (research, wiki, code, content, QA drafts). Claude only specs, spot-checks, architecture. Keep chat updates minimal.
- 2026-10-05: stack decided: Express5+EJS+node:sqlite, no React; plan in ARCHITECTURE.md/BUILD-PLAN.md
