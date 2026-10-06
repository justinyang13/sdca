-- 005_dp_blocks.sql — Phase DP (ROADMAP v3): store the faithful block tree per page.
-- blocks = JSON text of the ordered block tree (parser output, verbatim text).
-- source_url = old site URL this page was rebuilt from.
-- layout_notes = parser notes / hand-written block notes (Qwen).
ALTER TABLE pages ADD COLUMN blocks TEXT;
ALTER TABLE pages ADD COLUMN source_url TEXT;
ALTER TABLE pages ADD COLUMN layout_notes TEXT;
