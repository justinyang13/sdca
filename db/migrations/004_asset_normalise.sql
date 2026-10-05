-- 004 — Phase 9: normalise asset paths stored in DB rows to ROOT-ABSOLUTE.
-- Local paths without a leading slash (img/..., storage/..., brand/...)
-- become /img/... etc. Empty strings and http(s) URLs are left untouched.
-- One-off, idempotent (a second run matches nothing).

UPDATE people SET photo = '/' || photo
 WHERE photo <> '' AND photo NOT LIKE '/%' AND photo NOT LIKE 'http%' AND photo NOT LIKE 'data:%';
UPDATE programs SET image = '/' || image
 WHERE image <> '' AND image NOT LIKE '/%' AND image NOT LIKE 'http%';
UPDATE pages SET hero_image = '/' || hero_image
 WHERE hero_image <> '' AND hero_image NOT LIKE '/%' AND hero_image NOT LIKE 'http%';
UPDATE events SET image = '/' || image
 WHERE image <> '' AND image NOT LIKE '/%' AND image NOT LIKE 'http%';
UPDATE media_items SET image = '/' || image
 WHERE image <> '' AND image NOT LIKE '/%' AND image NOT LIKE 'http%';
UPDATE slides SET image = '/' || image
 WHERE image <> '' AND image NOT LIKE '/%' AND image NOT LIKE 'http%';
UPDATE sponsors SET logo = '/' || logo
 WHERE logo <> '' AND logo NOT LIKE '/%' AND logo NOT LIKE 'http%';
