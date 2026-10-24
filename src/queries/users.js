// src/queries/users.js — portal accounts and their roles.
export const userByUsername = (db, username) => db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(username);

export const grantRole = (db, userId, roleId, by) => db.prepare('INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES (?,?,?,?)').run(userId, roleId, by, by);
