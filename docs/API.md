# CAI Net API

ทุก endpoint รับ-ส่ง JSON อยู่ใต้ `/api` ล็อกอินแล้วเซิร์ฟเวอร์จะตั้ง cookie `cainet_session` (HttpOnly)
ถ้าผิดพลาดจะได้ `{ "error": "ข้อความภาษาไทย" }` พร้อม status 400 / 401 / 403 / 404 / 413
ฝั่งหน้าบ้านเรียกผ่าน `frontend/js/api.js`

`workspace` ในตารางหมายถึง `{ nodes, links, ... }` ตาม [DATA-FORMAT.md](DATA-FORMAT.md)

## เข้าสู่ระบบ

| Method | Path | Body | ผลลัพธ์ |
|---|---|---|---|
| POST | `/api/auth/student` | `{ studentId, name }` | `{ user }` สร้างบัญชีถ้ายังไม่มี |
| POST | `/api/auth/teacher` | `{ password }` | `{ user }` |
| POST | `/api/auth/logout` | – | `{ ok }` |
| GET | `/api/me` | – | `{ user }` หรือ `{ user: null }` |
| GET | `/api/progress` | – | `{ pretest, posttest, survey, missionsPassed, missionsTotal }` |

## Workspace (เห็นเฉพาะของตัวเอง)

| Method | Path | Body | ผลลัพธ์ |
|---|---|---|---|
| GET | `/api/workspaces` | – | `{ workspaces: [{ id, name, missionId, updatedAt }] }` |
| POST | `/api/workspaces` | `{ name, data, missionId? }` | `{ workspace }` (201) |
| GET | `/api/workspaces/:id` | – | `{ workspace: { ..., data } }` |
| PUT | `/api/workspaces/:id` | `{ name?, data? }` | `{ workspace }` |
| DELETE | `/api/workspaces/:id` | – | `{ ok }` |

## Network Engine

| Method | Path | Body | ผลลัพธ์ |
|---|---|---|---|
| POST | `/api/engine/analyze` | `{ workspace }` | `{ ok, devices[], links[], issues[], stats }` |
| POST | `/api/engine/ping` | `{ workspace, from, to, count? }` | `{ ok, code, lines[], path[], message, hint }` |
| POST | `/api/engine/traceroute` | `{ workspace, from, to }` | `{ ok, lines[], hops[], path[], message, hint }` |
| POST | `/api/engine/exec` | `{ workspace, device, command }` | `{ ok, lines[], clear?, path?, message?, hint? }` |
| POST | `/api/assistant/hint` | `{ workspace, level (1–3), attemptId? }` | `{ hasProblem, text, highlight[], level, remaining }` |

- `from` / `device` = id ของอุปกรณ์ · `to` = IP, ชื่อเครื่อง (ต้องมี DNS) หรือ id ของอุปกรณ์
- `issues[]` = `{ code, severity: "error"|"warning", deviceIds[], message, hints[3] }`
- `devices[]` = `{ id, name, type, ip, mask, gateway, dns, source: "static"|"dhcp"|"apipa"|"none", mac, hostname, connected, status }`
- `path[]` = id ของอุปกรณ์ที่ Packet วิ่งผ่าน (ใช้ทำแอนิเมชัน)
- คำใบ้ที่ขอระหว่างทำภารกิจ (`attemptId`) จะถูกนับและหักคะแนน

## ภารกิจ

| Method | Path | Body | ผลลัพธ์ |
|---|---|---|---|
| GET | `/api/missions` | – | `{ missions: [{ id, order, title, story, checks[], passed, bestScore, medal, attempts }] }` |
| POST | `/api/missions/:id/start` | – | `{ attemptId, mission, template }` |
| POST | `/api/missions/:id/check` | `{ attemptId, workspace }` | `{ passed, results[], issues[], score, medal, checks, hints, quiz }` |

คะแนน = 100 − 10 × (ครั้งที่ตรวจไม่ผ่าน, สูงสุด 40) − 5 × (คำใบ้, สูงสุด 30) ขั้นต่ำ 40 ·
เหรียญทอง ≥ 90, เงิน ≥ 75, ทองแดงต่ำกว่านั้น

## แบบทดสอบและแบบประเมิน

| Method | Path | Body | ผลลัพธ์ |
|---|---|---|---|
| GET | `/api/quizzes/:id` | – | `{ quiz, lastResult }` (ไม่มีเฉลย) |
| POST | `/api/quizzes/:id/submit` | `{ answers: { qid: index }, seconds? }` | `{ score, total, percent, results[] }` พร้อมเฉลยและคำอธิบาย |
| GET | `/api/survey` | – | `{ survey: { scale, items }, done }` |
| POST | `/api/survey` | `{ answers: [1–5 × 8], comment? }` | `{ ok }` |

`:id` = `pretest`, `posttest`, `m-lan-basic`, `m-wifi-lab`, `m-fix-ip`, `m-dhcp-server`

## ครู (ต้องล็อกอินเป็นครู)

| Method | Path | ผลลัพธ์ |
|---|---|---|
| GET | `/api/teacher/summary` | `{ students[], totals: { E1, E2, pretestMean, posttestMean, ... }, survey, topMistakes }` |
| GET | `/api/teacher/export.csv` | ไฟล์ CSV (UTF-8 BOM เปิดใน Excel ได้) |
| DELETE | `/api/teacher/students/:id` | ลบผู้เรียนและข้อมูลทั้งหมดของคนนั้น |
