'use strict';
// Teacher reports: per-student results, E1/E2 efficiency, survey statistics and CSV export.
const missions = require('./content/missions');
const { QUIZZES, SURVEY } = require('./content/quizzes');

const ISSUE_LABEL = {
  ISOLATED: 'อุปกรณ์ไม่ได้เชื่อมต่อ', AP_NOT_WIRED: 'Access Point ไม่ได้ต่อสาย', NO_IP: 'ไม่ได้ตั้ง IP', INVALID_IP: 'IP ผิดรูปแบบ',
  INVALID_MASK: 'Subnet Mask ผิด', RESERVED_IP: 'ใช้ IP ที่สงวนไว้', INVALID_GATEWAY: 'Gateway ผิดรูปแบบ', GATEWAY_OTHER_SUBNET: 'Gateway คนละวง',
  GATEWAY_NOT_ROUTER: 'Gateway ไม่ตรงกับ Router', DUPLICATE_IP: 'IP ซ้ำ', SUBNET_MISMATCH: 'IP คนละวงกับ Router', NO_DHCP_SERVER: 'ไม่พบ DHCP Server',
  MULTIPLE_DHCP: 'DHCP Server ซ้อนกัน', DHCP_POOL_FULL: 'DHCP แจก IP หมด', WIFI_AP_TO_AP: 'เชื่อม Wi-Fi ระหว่างตัวกระจายสัญญาณ',
  WIFI_NO_AP: 'Wi-Fi ไม่มีตัวกระจายสัญญาณ', WIFI_CLIENT_UNSUPPORTED: 'อุปกรณ์ไม่มี Wi-Fi', WIFI_AP_OFF: 'ปิด Wi-Fi ที่ตัวกระจายสัญญาณ',
  WIFI_CLIENT_OFF: 'Notebook ปิด Wi-Fi', WIFI_SSID_MISMATCH: 'เลือก SSID ผิด', WIFI_WRONG_PASSWORD: 'รหัสผ่าน Wi-Fi ผิด',
};

const round = (n, d = 2) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
// Sample standard deviation (n − 1), as used in Thai CAI research reports.
const sd = (xs) => {
  if (xs.length < 2) return xs.length ? 0 : null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const level = (m) => (m == null ? '-' : m >= 4.51 ? 'มากที่สุด' : m >= 3.51 ? 'มาก' : m >= 2.51 ? 'ปานกลาง' : m >= 1.51 ? 'น้อย' : 'น้อยที่สุด');

function students(db) {
  const users = db.prepare("SELECT id, student_id, name, created_at, last_login FROM users WHERE role = 'student' ORDER BY student_id").all();
  const quizRows = db.prepare('SELECT user_id, quiz_id, score, total, id FROM quiz_results ORDER BY id').all();
  const attempts = db.prepare('SELECT * FROM mission_attempts').all();
  const surveys = new Set(db.prepare('SELECT user_id FROM survey_responses').all().map((r) => r.user_id));
  const exerciseQuizzes = Object.values(QUIZZES).filter((q) => q.kind === 'exercise').map((q) => q.id);

  return users.map((u) => {
    const mine = quizRows.filter((q) => q.user_id === u.id);
    const pct = (r) => (r ? Math.round((r.score / r.total) * 100) : null);
    const pre = mine.find((q) => q.quiz_id === 'pretest'); // first attempt
    const post = [...mine].reverse().find((q) => q.quiz_id === 'posttest'); // latest attempt
    const myAttempts = attempts.filter((a) => a.user_id === u.id);
    const missionScores = {};
    let minutes = 0;
    for (const m of missions.MISSIONS) {
      const passed = myAttempts.filter((a) => a.mission_id === m.id && a.passed);
      missionScores[m.id] = passed.length ? Math.max(...passed.map((a) => a.score)) : null;
      for (const a of passed) minutes += (Date.parse(a.finished_at + 'Z') - Date.parse(a.started_at + 'Z')) / 60000;
    }
    const quizBest = {};
    for (const id of exerciseQuizzes) {
      const rs = mine.filter((q) => q.quiz_id === id);
      quizBest[id] = rs.length ? Math.max(...rs.map(pct)) : null;
    }
    const exerciseItems = [...Object.values(missionScores), ...Object.values(quizBest)];
    const anyExercise = exerciseItems.some((x) => x != null);
    return {
      id: u.id, studentId: u.student_id, name: u.name, lastLogin: u.last_login,
      pretest: pct(pre), posttest: pct(post),
      gain: pre && post ? pct(post) - pct(pre) : null,
      missions: missionScores,
      missionsPassed: Object.values(missionScores).filter((x) => x != null).length,
      exerciseQuizzes: quizBest,
      exercise: anyExercise ? round(mean(exerciseItems.map((x) => x ?? 0)), 1) : null,
      hints: myAttempts.reduce((n, a) => n + a.hints, 0),
      checks: myAttempts.reduce((n, a) => n + a.checks, 0),
      minutes: round(minutes, 1),
      survey: surveys.has(u.id),
    };
  });
}

function summary(db) {
  const list = students(db);
  const pre = list.map((s) => s.pretest).filter((x) => x != null);
  const post = list.map((s) => s.posttest).filter((x) => x != null);
  // E1 counts learners who finished the course (took the posttest); falls back to everyone with exercises.
  const finished = list.filter((s) => s.posttest != null && s.exercise != null);
  const e1Pool = (finished.length ? finished : list.filter((s) => s.exercise != null)).map((s) => s.exercise);

  const responses = db.prepare('SELECT answers FROM survey_responses').all().map((r) => JSON.parse(r.answers));
  const items = SURVEY.items.map((text, i) => {
    const xs = responses.map((a) => a[i]).filter(Number.isFinite);
    const m = mean(xs);
    return { text, mean: round(m), sd: round(sd(xs)), level: level(m) };
  });
  const all = responses.flat().filter(Number.isFinite);

  const mistakes = {};
  for (const a of db.prepare('SELECT mistakes FROM mission_attempts').all()) {
    for (const [k, v] of Object.entries(JSON.parse(a.mistakes))) {
      if (k.startsWith('issue:')) mistakes[k.slice(6)] = (mistakes[k.slice(6)] || 0) + v;
    }
  }
  const topMistakes = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([code, count]) => ({ code, label: ISSUE_LABEL[code] || code, count }));

  return {
    students: list,
    missions: missions.MISSIONS.map((m) => ({ id: m.id, title: m.title })),
    totals: {
      students: list.length,
      pretestMean: round(mean(pre), 1), pretestSd: round(sd(pre), 1), pretestN: pre.length,
      posttestMean: round(mean(post), 1), posttestSd: round(sd(post), 1), posttestN: post.length,
      E1: round(mean(e1Pool), 2), E2: round(mean(post), 2), e1N: e1Pool.length,
    },
    survey: { n: responses.length, items, overallMean: round(mean(all)), overallSd: round(sd(all)), overallLevel: level(mean(all)), comments: db.prepare("SELECT comment FROM survey_responses WHERE comment <> ''").all().map((r) => r.comment) },
    topMistakes,
  };
}

function csv(db) {
  const list = students(db);
  const ms = missions.MISSIONS;
  const head = ['รหัสนักเรียน', 'ชื่อ', 'ก่อนเรียน (%)', 'หลังเรียน (%)', 'พัฒนาการ (%)', ...ms.map((m) => `ภารกิจ: ${m.title}`), 'คะแนนระหว่างเรียน (%)', 'จำนวนคำใบ้', 'จำนวนครั้งที่ตรวจ', 'เวลาทำภารกิจ (นาที)', 'ทำแบบประเมินแล้ว'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = list.map((s) => [s.studentId, s.name, s.pretest, s.posttest, s.gain, ...ms.map((m) => s.missions[m.id]), s.exercise, s.hints, s.checks, s.minutes, s.survey ? 'ใช่' : 'ยังไม่ทำ']);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

module.exports = { summary, csv, students, mean, sd, level };
