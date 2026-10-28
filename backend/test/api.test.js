'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const { createApp, missionScore } = require('../src/app');
const missions = require('../src/content/missions');

const dev = (id, type, name, extra = {}) => ({ id, type, name, x: 0, y: 0, w: 110, h: 88, ...extra });
const cable = (a, b) => ({ a, b, kind: 'cable' });
const wifi = (a, b) => ({ a, b, kind: 'wireless' });
const pcCfg = (n) => ({ ip: `192.168.1.${n}`, mask: '255.255.255.0', gateway: '192.168.1.1' });

// A correct solution for each mission (what a learner should end up with).
const SOLUTIONS = {
  'lan-basic': (t) => ({
    nodes: [...t.nodes, dev('s1', 'switch', 'Switch'), dev('p1', 'pc', 'PC-01', pcCfg(11)), dev('p2', 'pc', 'PC-02', pcCfg(12)), dev('p3', 'pc', 'PC-03', pcCfg(13))],
    links: [cable('r1', 's1'), cable('s1', 'p1'), cable('s1', 'p2'), cable('s1', 'p3')],
  }),
  'wifi-lab': (t) => {
    const lap = (id, n) => dev(id, 'laptop', `Notebook-0${n}`, { ...pcCfg(20 + n), wifi: true, ssid: 'CAI-Lab', password: 'labsecret' });
    return {
      nodes: [...t.nodes, dev('a1', 'access', 'AP', { wifi: true, ssid: 'CAI-Lab', password: 'labsecret' }), lap('l1', 1), lap('l2', 2)],
      links: [...t.links, cable('s1', 'a1'), wifi('a1', 'l1'), wifi('a1', 'l2')],
    };
  },
  'fix-ip': (t) => ({
    nodes: t.nodes.map((n) => (n.type === 'pc' ? { ...n, ...pcCfg(10 + Number(n.id.slice(1))) } : n)),
    links: t.links,
  }),
  'dhcp-server': (t) => ({
    nodes: t.nodes.map((n) => (n.type === 'pc' ? { ...n, ip: '', dhcp: true } : n.id === 'srv' ? { ...n, ip: '192.168.1.10', gateway: '192.168.1.1', dns: '192.168.1.1' } : n)),
    links: t.links,
  }),
};

test('every mission: template fails, solution passes', () => {
  for (const m of missions.MISSIONS) {
    assert.equal(missions.runChecks(m, m.template).passed, false, `${m.id} template should not pass`);
    const solved = missions.runChecks(m, SOLUTIONS[m.id](structuredClone(m.template)));
    assert.deepEqual(solved.results.filter((r) => !r.pass), [], `${m.id} solution should pass`);
  }
});

test('mission shortcuts are rejected', () => {
  // fix-ip: deleting the broken PCs is not allowed.
  const fix = missions.byId('fix-ip');
  const t = structuredClone(fix.template);
  const deleted = { nodes: t.nodes.filter((n) => !['p3', 'p4', 'p5'].includes(n.id)), links: t.links.filter((l) => !['p3', 'p4', 'p5'].includes(l.b)) };
  assert.equal(missions.runChecks(fix, deleted).passed, false);
  // wifi-lab: the default password does not count.
  const wl = missions.byId('wifi-lab');
  const s = SOLUTIONS['wifi-lab'](structuredClone(wl.template));
  s.nodes.forEach((n) => { if (n.ssid === 'CAI-Lab') n.password = 'classroom123'; });
  assert.equal(missions.runChecks(wl, s).passed, false);
});

test('mission score', () => {
  assert.equal(missionScore(0, 0), 100);
  assert.equal(missionScore(2, 1), 75);
  assert.equal(missionScore(50, 50), 40);
});

// ---------- HTTP ----------

async function withServer(fn) {
  const db = await open(':memory:');
  const app = await createApp(db, { teacherPassword: 'pw-teacher' });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (method, url, body) => {
      const res = await fetch(base + url, {
        method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* CSV or HTML */ }
      return { status: res.status, body: json, text, headers: res.headers };
    };
  };
  try { await fn(client, base, db); } finally { server.close(); db.close(); }
}

test('auth, workspaces and ownership', () => withServer(async (client) => {
  const a = client(), b = client();
  assert.equal((await a('GET', '/api/workspaces')).status, 401);
  assert.equal((await a('POST', '/api/auth/student', { studentId: 'bad id!', name: 'X Y' })).status, 400);
  assert.equal((await a('POST', '/api/auth/student', { studentId: 'teacher', name: 'Hacker' })).status, 400);
  const login = await a('POST', '/api/auth/student', { studentId: '65001', name: 'สมชาย ใจดี' });
  assert.equal(login.status, 200);
  assert.equal((await a('GET', '/api/me')).body.user.studentId, '65001');
  await b('POST', '/api/auth/student', { studentId: '65002', name: 'สมหญิง เก่ง' });

  const data = { nodes: [dev('p1', 'pc', 'PC-01', pcCfg(11))], links: [], notes: [], strokes: [] };
  const created = await a('POST', '/api/workspaces', { name: 'งานแรก', data });
  assert.equal(created.status, 201);
  const id = created.body.workspace.id;
  assert.equal((await a('GET', '/api/workspaces')).body.workspaces.length, 1);
  assert.equal((await b('GET', `/api/workspaces/${id}`)).status, 404); // other student cannot read it
  assert.equal((await b('DELETE', `/api/workspaces/${id}`)).status, 404);
  const updated = await a('PUT', `/api/workspaces/${id}`, { name: 'งานแก้แล้ว' });
  assert.equal(updated.body.workspace.name, 'งานแก้แล้ว');
  assert.equal(updated.body.workspace.data.nodes[0].name, 'PC-01');
  assert.equal((await a('POST', '/api/workspaces', { name: 'x', data: { nodes: 'nope' } })).status, 400);
  assert.equal((await a('DELETE', `/api/workspaces/${id}`)).status, 200);
  assert.equal((await a('GET', '/api/workspaces')).body.workspaces.length, 0);

  assert.equal((await a('POST', '/api/auth/logout')).status, 200);
  assert.equal((await a('GET', '/api/workspaces')).status, 401);
}));

test('engine endpoints and assistant', () => withServer(async (client) => {
  const a = client();
  await a('POST', '/api/auth/student', { studentId: 's1', name: 'Test User' });
  const ws = { nodes: [dev('r1', 'router', 'Router', { ip: '192.168.1.1' }), dev('p1', 'pc', 'PC-01', pcCfg(11)), dev('p2', 'pc', 'PC-02', pcCfg(11))], links: [cable('r1', 'p1'), cable('r1', 'p2')] };
  const an = await a('POST', '/api/engine/analyze', { workspace: ws });
  assert.equal(an.body.issues[0].code, 'DUPLICATE_IP');
  assert.equal((await a('POST', '/api/engine/ping', { workspace: ws, from: 'r1', to: '192.168.1.11' })).body.code, 'IP_CONFLICT');
  assert.equal((await a('POST', '/api/engine/ping', { workspace: ws })).status, 400);
  assert.match((await a('POST', '/api/engine/exec', { workspace: ws, device: 'p1', command: 'ipconfig' })).body.lines.join('\n'), /192\.168\.1\.11/);
  assert.ok((await a('POST', '/api/engine/traceroute', { workspace: ws, from: 'p1', to: '192.168.1.1' })).body.lines.length > 0);
  const h1 = await a('POST', '/api/assistant/hint', { workspace: ws, level: 1 });
  assert.equal(h1.body.hasProblem, true);
  assert.deepEqual(h1.body.highlight, []);
  const h2 = await a('POST', '/api/assistant/hint', { workspace: ws, level: 2 });
  assert.deepEqual(h2.body.highlight.sort(), ['p1', 'p2']);
  assert.equal((await a('POST', '/api/engine/analyze', '{bad json')).status, 400);
  assert.equal((await a('GET', '/api/nothing')).status, 404);
}));

test('mission flow: start → fail → hint → pass → score', () => withServer(async (client) => {
  const a = client();
  await a('POST', '/api/auth/student', { studentId: 's1', name: 'Test User' });
  const list = await a('GET', '/api/missions');
  assert.equal(list.body.missions.length, 4);
  const start = await a('POST', '/api/missions/lan-basic/start');
  const { attemptId, template } = start.body;
  const c1 = await a('POST', '/api/missions/lan-basic/check', { attemptId, workspace: template });
  assert.equal(c1.body.passed, false);
  assert.equal(c1.body.score, null);
  await a('POST', '/api/assistant/hint', { workspace: template, attemptId, level: 1 });
  const solved = SOLUTIONS['lan-basic'](template);
  const c2 = await a('POST', '/api/missions/lan-basic/check', { attemptId, workspace: solved });
  assert.equal(c2.body.passed, true);
  assert.equal(c2.body.score, missionScore(1, 1)); // 1 failed check, 1 hint = 85
  assert.equal(c2.body.medal, 'silver');
  // Re-checking after passing keeps the score.
  assert.equal((await a('POST', '/api/missions/lan-basic/check', { attemptId, workspace: template })).body.score, 85);
  const after = await a('GET', '/api/missions');
  assert.equal(after.body.missions[0].passed, true);
  assert.equal(after.body.missions[0].bestScore, 85);
  // Another student cannot use this attempt.
  const b = client();
  await b('POST', '/api/auth/student', { studentId: 's2', name: 'Other User' });
  assert.equal((await b('POST', '/api/missions/lan-basic/check', { attemptId, workspace: solved })).status, 404);
}));

test('teacher login is locked after 10 wrong passwords', () => withServer(async (client) => {
  const t = client();
  for (let i = 0; i < 10; i++) assert.equal((await t('POST', '/api/auth/teacher', { password: 'wrong' + i })).status, 401);
  const locked = await t('POST', '/api/auth/teacher', { password: 'pw-teacher' });
  assert.equal(locked.status, 429); // even the right password waits until the lock ends
  assert.match(locked.body.error, /รอ \d+ นาที/);
}));

test('a correct teacher password resets the failure count', () => withServer(async (client) => {
  const t = client();
  for (let i = 0; i < 9; i++) await t('POST', '/api/auth/teacher', { password: 'wrong' });
  assert.equal((await t('POST', '/api/auth/teacher', { password: 'pw-teacher' })).status, 200);
  for (let i = 0; i < 9; i++) assert.equal((await t('POST', '/api/auth/teacher', { password: 'wrong' })).status, 401);
}));

test('static files do not query the database', () => withServer(async (client, base, db) => {
  let queries = 0;
  for (const k of ['get', 'all', 'run']) { const f = db[k]; db[k] = (...a) => { queries++; return f(...a); }; }
  for (const p of ['/', '/css/style.css', '/js/app.js']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    await res.arrayBuffer();
  }
  assert.equal(queries, 0);
  const a = client();
  await a('POST', '/api/auth/student', { studentId: 's1', name: 'Test User' });
  queries = 0;
  assert.equal((await a('GET', '/api/me')).body.user.studentId, 's1');
  assert.ok(queries > 0); // API calls still look up the session
}));

test('missions unlock in order; lessons are tracked', () => withServer(async (client) => {
  const a = client();
  await a('POST', '/api/auth/student', { studentId: 's1', name: 'Test User' });
  let list = (await a('GET', '/api/missions')).body.missions;
  assert.deepEqual(list.map((m) => m.unlocked), [true, false, false, false]);
  assert.equal(list[1].requires, 'lan-basic');
  assert.equal(list[0].lesson.id, 'lan');
  // Skipping ahead through the API is refused.
  const skip = await a('POST', '/api/missions/wifi-lab/start');
  assert.equal(skip.status, 403);
  assert.match(skip.body.error, /ภารกิจที่ 1/);

  // Lessons: list, read content, mark as read (twice is fine).
  const lessons = (await a('GET', '/api/lessons')).body.lessons;
  assert.equal(lessons.length, 4);
  assert.ok(lessons.every((l) => l.read === false));
  const one = await a('GET', '/api/lessons/ip');
  assert.ok(one.body.lesson.sections.length > 0);
  assert.equal((await a('GET', '/api/lessons/nope')).status, 404);
  assert.equal((await a('POST', '/api/lessons/ip/read')).status, 200);
  assert.equal((await a('POST', '/api/lessons/ip/read')).status, 200);
  assert.equal((await a('GET', '/api/progress')).body.lessonsRead, 1);

  // Pass mission 1 → mission 2 unlocks.
  const { attemptId, template } = (await a('POST', '/api/missions/lan-basic/start')).body;
  await a('POST', '/api/missions/lan-basic/check', { attemptId, workspace: SOLUTIONS['lan-basic'](template) });
  list = (await a('GET', '/api/missions')).body.missions;
  assert.deepEqual(list.map((m) => m.unlocked), [true, true, false, false]);
  assert.equal((await a('POST', '/api/missions/wifi-lab/start')).status, 201);
  // A passed mission can always be replayed.
  assert.equal((await a('POST', '/api/missions/lan-basic/start')).status, 201);

  const t = client();
  await t('POST', '/api/auth/teacher', { password: 'pw-teacher' });
  assert.equal((await t('GET', '/api/teacher/summary')).body.students[0].lessonsRead, 1);
}));

test('every lesson links to an existing mission, in the same order', () => {
  const lessons = require('../src/content/lessons');
  for (const l of lessons.LESSONS) assert.equal(missions.byId(l.mission)?.order, l.order, l.id);
});

test('quizzes, survey and teacher reports', () => withServer(async (client) => {
  const a = client();
  await a('POST', '/api/auth/student', { studentId: '65001', name: 'สมชาย ใจดี' });
  const quiz = await a('GET', '/api/quizzes/pretest');
  assert.equal(quiz.body.quiz.questions.length, 10);
  assert.equal(quiz.body.quiz.questions[0].answer, undefined); // answers stay on the server
  const sub = await a('POST', '/api/quizzes/pretest/submit', { answers: { q1: 1, q2: 2, q3: 0 }, seconds: 90 });
  assert.equal(sub.body.score, 2);
  assert.equal(sub.body.results[2].explain.length > 0, true);
  const all = Object.fromEntries((await a('GET', '/api/quizzes/posttest')).body.quiz.questions.map((q) => [q.id, null]));
  const post = await a('POST', '/api/quizzes/posttest/submit', { answers: { ...all, q1: 1, q2: 2, q3: 2, q4: 1, q5: 1, q6: 1, q7: 0, q8: 1 } });
  assert.equal(post.body.percent, 80);
  assert.equal((await a('GET', '/api/quizzes/nope')).status, 404);

  assert.equal((await a('POST', '/api/survey', { answers: [5, 5, 4] })).status, 400);
  assert.equal((await a('POST', '/api/survey', { answers: [5, 5, 4, 4, 5, 5, 4, 5], comment: 'สนุกมาก' })).status, 200);
  const prog = await a('GET', '/api/progress');
  assert.deepEqual([prog.body.pretest, prog.body.posttest, prog.body.survey], [true, true, true]);

  assert.equal((await a('GET', '/api/teacher/summary')).status, 403);
  const t = client();
  assert.equal((await t('POST', '/api/auth/teacher', { password: 'wrong' })).status, 401);
  assert.equal((await t('POST', '/api/auth/teacher', { password: 'pw-teacher' })).status, 200);
  const sum = await t('GET', '/api/teacher/summary');
  assert.equal(sum.body.totals.students, 1);
  assert.equal(sum.body.students[0].pretest, 20);
  assert.equal(sum.body.students[0].posttest, 80);
  assert.equal(sum.body.totals.E2, 80);
  assert.equal(sum.body.survey.items[0].mean, 5);
  assert.equal(sum.body.survey.overallMean, 4.63);
  const csv = await t('GET', '/api/teacher/export.csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.text, /65001,สมชาย ใจดี,20,80,60/);
  assert.equal((await t('DELETE', `/api/teacher/students/${sum.body.students[0].id}`)).status, 200);
  assert.equal((await t('GET', '/api/teacher/summary')).body.totals.students, 0);
  assert.equal((await t('DELETE', `/api/teacher/students/${sum.body.students[0].id}`)).status, 404);
  // The old session is gone and logging in again with the same ID starts from scratch.
  assert.equal((await a('GET', '/api/progress')).status, 401);
  await a('POST', '/api/auth/student', { studentId: '65001', name: 'สมชาย ใจดี' });
  const fresh = (await a('GET', '/api/progress')).body;
  assert.deepEqual([fresh.pretest, fresh.posttest, fresh.survey, fresh.lessonsRead], [false, false, false, 0]);
  assert.equal((await t('GET', '/api/teacher/summary')).body.survey.n, 0);
}));
