-- Every board position may manage the home-page banner slides (Hero Slides). Only adds missing grants.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'all' FROM roles r JOIN permissions p ON p.resource = 'slides' WHERE r.code LIKE 'board\_%' ESCAPE '\';
