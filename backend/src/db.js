'use strict';
// Database access through libSQL: a local SQLite file on your own computer, or a Turso cloud
// database when TURSO_DATABASE_URL is set (used on hosts such as Render, whose disk is wiped on restart).
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'cai-net.db');
const REMOTE_URL = process.env.TURSO_DATABASE_URL || '';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_login  TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workspaces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,
    mission_id  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mission_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id  TEXT NOT NULL,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    checks      INTEGER NOT NULL DEFAULT 0,
    hints       INTEGER NOT NULL DEFAULT 0,
    passed      INTEGER NOT NULL DEFAULT 0,
    score       INTEGER,
    mistakes    TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS quiz_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id     TEXT NOT NULL,
    score       INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    answers     TEXT NOT NULL,
    seconds     INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS survey_responses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    answers     TEXT NOT NULL,
    comment     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS lesson_reads (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id   TEXT NOT NULL,
    read_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id)
  );
  CREATE INDEX IF NOT EXISTS idx_ws_user ON workspaces(user_id);
  CREATE INDEX IF NOT EXISTS idx_attempt_user ON mission_attempts(user_id, mission_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_results(user_id, quiz_id);
`;

// Rows become plain objects keyed by column name (libSQL rows also carry numeric index keys).
function plain(result) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])));
}

function wrap(client) {
  const exec = (sql, params) => client.execute({ sql, args: params.map((v) => (v === undefined ? null : v)) });
  return {
    async get(sql, ...params) {
      return plain(await exec(sql, params))[0];
    },
    async all(sql, ...params) {
      return plain(await exec(sql, params));
    },
    async run(sql, ...params) {
      const r = await exec(sql, params);
      return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
    },
    close: () => client.close(),
  };
}

// target: ':memory:' (tests), a file path, or nothing to use the environment / default file.
async function open(target) {
  let config;
  if (target === ':memory:') config = { url: ':memory:' };
  else if (!target && REMOTE_URL) config = { url: REMOTE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  else {
    const file = target || DB_FILE;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    config = { url: 'file:' + file.replace(/\\/g, '/') };
  }
  const client = createClient(config);
  await client.executeMultiple(SCHEMA);
  const db = wrap(client);
  await db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  return db;
}

const describe = () => (REMOTE_URL ? `Turso (${REMOTE_URL.replace(/\?.*$/, '')})` : DB_FILE);

module.exports = { open, describe, DB_FILE };
