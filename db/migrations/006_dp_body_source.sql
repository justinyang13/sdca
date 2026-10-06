-- 006_dp_body_source.sql — Phase DP: track whether a page body came from the
-- faithful import or from a later admin edit. The DP importer only writes
-- pages whose body_source is 'import' (or rows it creates itself); the admin
-- page editor sets body_source='admin'. The renderer prefers imported blocks
-- except on admin-edited pages, where the admin body wins.
ALTER TABLE pages ADD COLUMN body_source TEXT NOT NULL DEFAULT 'import';
ALTER TABLE pages ADD COLUMN import_hash TEXT NOT NULL DEFAULT '';
