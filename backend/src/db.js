'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'cai-net.db');

function open(file = DB_FILE) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
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
  `);
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return db;
}

module.exports = { open, DB_FILE };
