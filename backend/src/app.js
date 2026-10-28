'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const engine = require('./engine/network');
const missions = require('./content/missions');
const { QUIZZES, SURVEY, publicQuiz } = require('./content/quizzes');
const stats = require('./stats');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const COOKIE = 'cainet_session';
const SESSION_DAYS = 7;
const MAX_WORKSPACES = 100;
const STUDENT_ID_RE = /^[A-Za-z0-9._-]{1,20}$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
// Wraps a handler so thrown errors (sync or async) reach the error middleware.
const h = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function medalFor(score) {
  return score >= 90 ? 'gold' : score >= 75 ? 'silver' : 'bronze';
}

// Fewer failed checks and hints → higher score (40–100).
function missionScore(failedChecks, hints) {
  return Math.max(40, 100 - Math.min(40, failedChecks * 10) - Math.min(30, hints * 5));
}

function workspaceInput(body) {
  const ws = body && typeof body.workspace === 'object' && body.workspace ? body.workspace : null;
  if (!ws) fail(400, 'ต้องส่งข้อมูล workspace มาด้วย');
  return ws;
}

function createApp(db, options = {}) {
  const teacherPassword = options.teacherPassword || process.env.TEACHER_PASSWORD || 'teacher1234';
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // Reserved teacher account.
  db.prepare("INSERT OR IGNORE INTO users (student_id, name, role) VALUES ('teacher', 'ครูผู้สอน', 'teacher')").run();

  // ----- Session handling -----
  const startSession = (res, userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).run(token, userId);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
  };

  app.use((req, _res, next) => {
    const token = readCookie(req, COOKIE);
    req.user = token
      ? db.prepare(`SELECT u.id, u.student_id AS studentId, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
                    WHERE s.token = ? AND s.expires_at > datetime('now')`).get(token) || null
      : null;
    req.token = token;
    next();
  });
  const auth = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน')));
  const teacherOnly = (req, _res, next) => (req.user?.role === 'teacher' ? next() : next(new HttpError(403, 'สำหรับครูผู้สอนเท่านั้น')));

  // ----- Auth -----
  app.post('/api/auth/student', h((req, res) => {
    const studentId = String(req.body?.studentId || '').trim();
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    if (!STUDENT_ID_RE.test(studentId)) fail(400, 'รหัสนักเรียนต้องเป็นตัวอักษรอังกฤษหรือตัวเลข 1–20 ตัว');
    if (studentId.toLowerCase() === 'teacher') fail(400, 'รหัสนี้สงวนไว้สำหรับครู');
    if (name.length < 2 || name.length > 80) fail(400, 'กรุณากรอกชื่อ-นามสกุล (2–80 ตัวอักษร)');
    let user = db.prepare('SELECT id, role FROM users WHERE student_id = ?').get(studentId);
    if (user) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
    else user = { id: db.prepare('INSERT INTO users (student_id, name) VALUES (?, ?)').run(studentId, name).lastInsertRowid };
    startSession(res, user.id);
    res.json({ user: { id: Number(user.id), studentId, name, role: 'student' } });
  }));

  app.post('/api/auth/teacher', h((req, res) => {
    if (!safeEqual(req.body?.password || '', teacherPassword)) fail(401, 'รหัสผ่านไม่ถูกต้อง');
    const t = db.prepare("SELECT id, student_id AS studentId, name, role FROM users WHERE student_id = 'teacher'").get();
    startSession(res, t.id);
    res.json({ user: t });
  }));

  app.post('/api/auth/logout', (req, res) => {
    if (req.token) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => res.json({ user: req.user }));

  // ----- Workspaces -----
  const ownWorkspace = (req) => {
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!row) fail(404, 'ไม่พบ Workspace นี้');
    return row;
  };
  const wsOut = (r, withData = true) => ({
    id: r.id, name: r.name, missionId: r.mission_id, createdAt: r.created_at, updatedAt: r.updated_at,
    ...(withData ? { data: JSON.parse(r.data) } : {}),
  });
  const cleanData = (d) => {
    if (!d || typeof d !== 'object' || !Array.isArray(d.nodes)) fail(400, 'รูปแบบ Workspace ไม่ถูกต้อง');
    const keep = { nodes: d.nodes, links: Array.isArray(d.links) ? d.links : [], notes: Array.isArray(d.notes) ? d.notes : [], strokes: Array.isArray(d.strokes) ? d.strokes : [] };
    if (d.missionAttemptId) keep.missionAttemptId = Number(d.missionAttemptId) || null;
    const json = JSON.stringify(keep);
    if (json.length > 1_000_000) fail(413, 'Workspace ใหญ่เกินไป');
    return json;
  };

  app.get('/api/workspaces', auth, (req, res) => {
    const rows = db.prepare('SELECT id, name, mission_id, created_at, updated_at FROM workspaces WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
    res.json({ workspaces: rows.map((r) => wsOut(r, false)) });
  });
  app.post('/api/workspaces', auth, h((req, res) => {
    const count = db.prepare('SELECT COUNT(*) AS n FROM workspaces WHERE user_id = ?').get(req.user.id).n;
    if (count >= MAX_WORKSPACES) fail(400, `บันทึกได้สูงสุด ${MAX_WORKSPACES} Workspace กรุณาลบงานเก่าก่อน`);
    const name = String(req.body?.name || 'Workspace').trim().slice(0, 80) || 'Workspace';
    const missionId = req.body?.missionId && missions.byId(req.body.missionId) ? req.body.missionId : null;
    const info = db.prepare('INSERT INTO workspaces (user_id, name, data, mission_id) VALUES (?, ?, ?, ?)').run(req.user.id, name, cleanData(req.body?.data), missionId);
    res.status(201).json({ workspace: wsOut(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(info.lastInsertRowid)) });
  }));
  app.get('/api/workspaces/:id', auth, h((req, res) => res.json({ workspace: wsOut(ownWorkspace(req)) })));
  app.put('/api/workspaces/:id', auth, h((req, res) => {
    const row = ownWorkspace(req);
    const name = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 80) || row.name : row.name;
    const data = req.body?.data !== undefined ? cleanData(req.body.data) : row.data;
    db.prepare("UPDATE workspaces SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ?").run(name, data, row.id);
    res.json({ workspace: wsOut(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(row.id)) });
  }));
  app.delete('/api/workspaces/:id', auth, h((req, res) => {
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(ownWorkspace(req).id);
    res.json({ ok: true });
  }));

  // ----- Network engine -----
  app.post('/api/engine/analyze', auth, h((req, res) => res.json(engine.analyze(workspaceInput(req.body)))));
  app.post('/api/engine/ping', auth, h((req, res) => {
    const { from, to, count } = req.body || {};
    if (!from || !to) fail(400, 'ต้องระบุเครื่องต้นทาง (from) และปลายทาง (to)');
    res.json(engine.ping(workspaceInput(req.body), String(from), String(to), count));
  }));
  app.post('/api/engine/traceroute', auth, h((req, res) => {
    const { from, to } = req.body || {};
    if (!from || !to) fail(400, 'ต้องระบุเครื่องต้นทาง (from) และปลายทาง (to)');
    res.json(engine.traceroute(workspaceInput(req.body), String(from), String(to)));
  }));
  app.post('/api/engine/exec', auth, h((req, res) => {
    const { device, command } = req.body || {};
    if (!device) fail(400, 'ต้องระบุเครื่องที่ใช้รันคำสั่ง (device)');
    res.json(engine.exec(workspaceInput(req.body), String(device), String(command || '').slice(0, 200)));
  }));

  // ----- CAI Assistant (rule-based, 3 hint levels) -----
  const ownAttempt = (userId, attemptId, missionId) => {
    if (!attemptId) return null;
    const a = db.prepare('SELECT * FROM mission_attempts WHERE id = ? AND user_id = ?').get(Number(attemptId), userId);
    if (!a || (missionId && a.mission_id !== missionId)) fail(404, 'ไม่พบการทำภารกิจนี้');
    return a;
  };
  app.post('/api/assistant/hint', auth, h((req, res) => {
    const ws = workspaceInput(req.body);
    const level = Math.min(Math.max(parseInt(req.body.level, 10) || 1, 1), 3);
    const analysis = engine.analyze(ws);
    const attempt = ownAttempt(req.user.id, req.body.attemptId);
    let target = analysis.issues[0];
    let text;
    if (target) {
      text = target.hints[level - 1];
    } else if (attempt && !attempt.passed) {
      // Network is clean but the mission is not done: point at the first unmet mission condition.
      const m = missions.byId(attempt.mission_id);
      const unmet = missions.runChecks(m, ws).results.find((r) => !r.pass);
      if (unmet) {
        target = { code: 'MISSION', deviceIds: [] };
        text = ['เครือข่ายยังไม่มีข้อผิดพลาด แต่ภารกิจยังไม่ครบ', `เงื่อนไขที่ยังไม่ผ่าน: ${unmet.label}`, `ทำให้ครบเงื่อนไข "${unmet.label}" แล้วกด "ตรวจภารกิจ" อีกครั้ง`][level - 1];
      }
    }
    if (attempt && target && !attempt.passed) db.prepare('UPDATE mission_attempts SET hints = hints + 1 WHERE id = ?').run(attempt.id);
    res.json({
      level,
      hasProblem: !!target,
      text: text || 'เยี่ยมมาก! ไม่พบปัญหาในเครือข่ายนี้ ลองใช้ Network Utility หรือ Terminal ทดสอบ ping ดูได้เลย',
      code: target?.code || null,
      highlight: level >= 2 && target ? target.deviceIds : [],
      remaining: analysis.issues.length,
    });
  }));

  // ----- Missions -----
  const progressFor = (userId) => {
    const rows = db.prepare(`SELECT mission_id, COUNT(*) AS attempts, MAX(passed) AS passed, MAX(score) AS best
                             FROM mission_attempts WHERE user_id = ? GROUP BY mission_id`).all(userId);
    return new Map(rows.map((r) => [r.mission_id, r]));
  };
  app.get('/api/missions', auth, (req, res) => {
    const prog = progressFor(req.user.id);
    res.json({
      missions: missions.MISSIONS.map((m) => {
        const p = prog.get(m.id);
        return { ...missions.publicMission(m), attempts: p?.attempts || 0, passed: !!p?.passed, bestScore: p?.best ?? null, medal: p?.best != null ? medalFor(p.best) : null };
      }),
    });
  });
  app.post('/api/missions/:id/start', auth, h((req, res) => {
    const m = missions.byId(req.params.id) || fail(404, 'ไม่พบภารกิจนี้');
    const attemptId = Number(db.prepare('INSERT INTO mission_attempts (user_id, mission_id) VALUES (?, ?)').run(req.user.id, m.id).lastInsertRowid);
    res.status(201).json({ attemptId, mission: missions.publicMission(m), template: structuredClone(m.template) });
  }));
  app.post('/api/missions/:id/check', auth, h((req, res) => {
    const m = missions.byId(req.params.id) || fail(404, 'ไม่พบภารกิจนี้');
    const attempt = ownAttempt(req.user.id, req.body?.attemptId, m.id) || fail(400, 'ต้องเริ่มภารกิจก่อน (attemptId)');
    const result = missions.runChecks(m, workspaceInput(req.body));
    let { score, passed } = attempt;
    const mistakes = JSON.parse(attempt.mistakes);
    if (!passed) {
      for (const r of result.results) if (!r.pass) mistakes[r.id] = (mistakes[r.id] || 0) + 1;
      for (const i of result.analysis.issues) mistakes['issue:' + i.code] = (mistakes['issue:' + i.code] || 0) + 1;
      if (result.passed) {
        score = missionScore(attempt.checks, attempt.hints);
        passed = 1;
        db.prepare("UPDATE mission_attempts SET checks = checks + 1, passed = 1, score = ?, finished_at = datetime('now'), mistakes = ? WHERE id = ?").run(score, JSON.stringify(mistakes), attempt.id);
      } else {
        db.prepare('UPDATE mission_attempts SET checks = checks + 1, mistakes = ? WHERE id = ?').run(JSON.stringify(mistakes), attempt.id);
      }
    }
    const fresh = db.prepare('SELECT checks, hints, started_at, finished_at FROM mission_attempts WHERE id = ?').get(attempt.id);
    res.json({
      passed: result.passed, results: result.results,
      issues: result.analysis.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message, deviceIds: i.deviceIds })),
      score: passed ? score : null, medal: passed ? medalFor(score) : null,
      checks: fresh.checks, hints: fresh.hints, quiz: m.quiz,
    });
  }));

  // ----- Quizzes -----
  app.get('/api/quizzes/:id', auth, h((req, res) => {
    const quiz = QUIZZES[req.params.id] || fail(404, 'ไม่พบแบบทดสอบนี้');
    const last = db.prepare('SELECT score, total, created_at FROM quiz_results WHERE user_id = ? AND quiz_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id, quiz.id);
    res.json({ quiz: publicQuiz(quiz), lastResult: last || null });
  }));
  app.post('/api/quizzes/:id/submit', auth, h((req, res) => {
    const quiz = QUIZZES[req.params.id] || fail(404, 'ไม่พบแบบทดสอบนี้');
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : fail(400, 'ต้องส่งคำตอบ (answers)');
    const results = quiz.questions.map((q) => {
      const chosen = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
      return { id: q.id, chosen, correct: chosen === q.answer, answer: q.answer, explain: q.explain };
    });
    const score = results.filter((r) => r.correct).length;
    const seconds = Number.isFinite(req.body.seconds) ? Math.max(0, Math.round(req.body.seconds)) : null;
    db.prepare('INSERT INTO quiz_results (user_id, quiz_id, score, total, answers, seconds) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, quiz.id, score, results.length, JSON.stringify(results.map((r) => [r.id, r.chosen])), seconds);
    res.json({ score, total: results.length, percent: Math.round((score / results.length) * 100), results });
  }));

  // ----- Survey -----
  app.get('/api/survey', auth, (req, res) => {
    const done = !!db.prepare('SELECT 1 FROM survey_responses WHERE user_id = ?').get(req.user.id);
    res.json({ survey: SURVEY, done });
  });
  app.post('/api/survey', auth, h((req, res) => {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : fail(400, 'ต้องส่งคำตอบ (answers)');
    if (answers.length !== SURVEY.items.length || !answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5)) fail(400, 'กรุณาตอบให้ครบทุกข้อ (1–5)');
    const comment = String(req.body.comment || '').trim().slice(0, 1000);
    db.prepare(`INSERT INTO survey_responses (user_id, answers, comment) VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, comment = excluded.comment, created_at = datetime('now')`)
      .run(req.user.id, JSON.stringify(answers), comment);
    res.json({ ok: true });
  }));

  // ----- Learner progress (for the desktop) -----
  app.get('/api/progress', auth, (req, res) => {
    const done = (id) => !!db.prepare('SELECT 1 FROM quiz_results WHERE user_id = ? AND quiz_id = ?').get(req.user.id, id);
    const prog = progressFor(req.user.id);
    res.json({
      pretest: done('pretest'), posttest: done('posttest'),
      survey: !!db.prepare('SELECT 1 FROM survey_responses WHERE user_id = ?').get(req.user.id),
      missionsPassed: missions.MISSIONS.filter((m) => prog.get(m.id)?.passed).length,
      missionsTotal: missions.MISSIONS.length,
    });
  });

  // ----- Teacher -----
  app.get('/api/teacher/summary', auth, teacherOnly, (req, res) => res.json(stats.summary(db)));
  app.get('/api/teacher/export.csv', auth, teacherOnly, (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cai-net-results.csv"');
    res.send('﻿' + stats.csv(db));
  });
  app.delete('/api/teacher/students/:id', auth, teacherOnly, h((req, res) => {
    const info = db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(Number(req.params.id));
    if (!info.changes) fail(404, 'ไม่พบนักเรียนคนนี้');
    res.json({ ok: true });
  }));

  // ----- Errors & static files -----
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'ไม่พบ API นี้')));
  app.use(express.static(FRONTEND_DIR));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' : err.message || 'คำขอไม่ถูกต้อง' });
  });
  return app;
}

module.exports = { createApp, missionScore, medalFor };
