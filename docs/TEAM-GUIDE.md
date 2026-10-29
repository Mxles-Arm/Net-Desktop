# คู่มือทำงานร่วมกัน (สำหรับทีม CAI Net)

อ่านไฟล์นี้ก่อนเริ่มแก้งาน — มีวิธีติดตั้ง วิธีดึง/ส่งงานผ่าน Git บัญชีทดสอบ และข้อควรระวังที่ทำให้ระบบพังได้

- repo หลัก: <https://github.com/Mxles-Arm/Net-Desktop> (สาขา `main`)
- เว็บที่ขึ้น Host: อยู่บน Render — **ทุกครั้งที่ push ขึ้น `main` เว็บจริงจะอัปเดตตามอัตโนมัติ** (ดูหัวข้อ 6)

---

## 1. ติดตั้งครั้งแรก (ทำครั้งเดียว)

1. ติดตั้ง [Git](https://git-scm.com/downloads) และ [Node.js](https://nodejs.org) — แนะนำ Node.js เวอร์ชัน 24 (ใช้ 20 หรือ 22 ก็ได้ ทดสอบแล้ว)
2. รับคำเชิญเข้า repo ที่อีเมล หรือที่ <https://github.com/Mxles-Arm/Net-Desktop/invitations>
3. ตั้งชื่อและอีเมลใน Git (ใช้อีเมลเดียวกับบัญชี GitHub ของตัวเอง — **อย่าพิมพ์อะไรต่อท้ายอีเมล**):

   ```bash
   git config --global user.name "ชื่อ GitHub ของคุณ"
   git config --global user.email "อีเมลของคุณ@gmail.com"
   ```

4. ดาวน์โหลดโปรเจกต์ **ลงโฟลเดอร์ใหม่** (อย่าใช้โฟลเดอร์ repo เดิมของตัวเอง เพราะโครงสร้างไฟล์เปลี่ยนไปแล้ว):

   ```bash
   git clone https://github.com/Mxles-Arm/Net-Desktop.git
   cd Net-Desktop
   npm run setup
   ```

5. เปิดระบบ:

   ```bash
   npm start
   ```

   แล้วเข้า <http://localhost:3000> — ปิดเซิร์ฟเวอร์ด้วย `Ctrl + C`

> ต้องเปิดผ่าน `npm start` เสมอ ถ้าดับเบิลคลิก `index.html` ตรง ๆ จะขึ้น "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"

---

## 2. ทุกครั้งที่จะเริ่มทำงาน — ดึงงานล่าสุดก่อน

```bash
git pull
npm run setup
```

- `git pull` = ดึงงานที่อีกคน push ไว้มาไว้ในเครื่อง **ทำก่อนแก้อะไรทุกครั้ง** จะได้ไม่ชนกัน
- `npm run setup` = ติดตั้งแพ็กเกจที่อาจเพิ่มมาใหม่ (ถ้าไม่มีอะไรใหม่จะเสร็จเร็ว รันทุกครั้งได้ไม่เสียหาย)
- ถ้าเปิดเซิร์ฟเวอร์ค้างไว้ ให้ `Ctrl + C` แล้ว `npm start` ใหม่หลัง pull

## 3. ระหว่างทำงาน

- แก้ไฟล์ใน `frontend/` แล้ว **กดรีเฟรชเบราว์เซอร์ (F5) ก็เห็นผล** ไม่ต้องรีสตาร์ตเซิร์ฟเวอร์
- แก้ไฟล์ใน `backend/` ต้อง `Ctrl + C` แล้ว `npm start` ใหม่
- ถ้าแก้ JavaScript แล้วหน้าเว็บค้าง กด F12 → แท็บ Console ดู error สีแดง

## 4. ส่งงานขึ้น GitHub

```bash
git status
git add -A
git commit -m "อธิบายสั้น ๆ ว่าแก้อะไร"
git pull
git push
```

- `git status` = ดูว่าแก้ไฟล์อะไรไปบ้าง ตรวจก่อนว่าไม่มีไฟล์แปลก ๆ ติดไป
- `git pull` ก่อน `git push` เผื่ออีกคน push อะไรมาระหว่างที่เราทำ
- ถ้า `git push` ขึ้นว่า **rejected** แปลว่ามีงานใหม่บน GitHub → `git pull` แล้ว `git push` ใหม่

### ถ้า `git pull` บอกว่า CONFLICT (แก้บรรทัดเดียวกันทั้งสองคน)

1. เปิดไฟล์ที่ Git บอก จะเห็นแบบนี้:

   ```
   <<<<<<< HEAD
   โค้ดของเรา
   =======
   โค้ดของอีกคน
   >>>>>>> ...
   ```

2. เลือก/รวมโค้ดให้ถูก แล้ว **ลบเส้น `<<<<<<<`, `=======`, `>>>>>>>` ออกให้หมด**
3. ทดสอบว่ายังใช้งานได้ แล้ว:

   ```bash
   git add -A
   git commit -m "รวมงาน"
   git push
   ```

ถ้าไม่แน่ใจ **อย่าเดา** — ทักอีกคนก่อน (ยกเลิกการ merge ที่ค้างอยู่ได้ด้วย `git merge --abort`)

### แบ่งงานเพื่อไม่ให้ชนกัน

| ใครดูแล | ไฟล์ |
|---|---|
| หน้าบ้าน (แต่งหน้าตา) | `frontend/css/style.css`, `frontend/css/cai.css`, `frontend/css/teacher.css`, รูปใน `frontend/assets/` |
| หลังบ้าน | `backend/` ทั้งหมด, `render.yaml` |
| ใช้ร่วมกัน — **บอกกันก่อนแก้** | `frontend/index.html`, `frontend/teacher.html`, `frontend/js/*.js` |

---

## 5. บัญชีสำหรับทดสอบ

| ใช้ที่ไหน | ผู้เรียน | ครู (`/teacher.html`) |
|---|---|---|
| เครื่องตัวเอง (`npm start`) | รหัสอะไรก็ได้ เช่น `test01` + ชื่อ (ไม่มีรหัสผ่าน) | รหัสผ่าน `teacher1234` |
| เว็บจริงบน Render | รหัสอะไรก็ได้ | **ถามเจ้าของ repo** — ห้ามเขียนรหัสจริงลงไฟล์ใด ๆ ใน repo เพราะ repo เป็นสาธารณะ |

- รหัสนักเรียนต้องเป็นตัวเลข/อังกฤษ — ถ้าแป้นพิมพ์เป็นภาษาไทยจะมีคำเตือนขึ้น (กด `~` หรือ `Alt + Shift` เปลี่ยนเป็น ENG)
- ใส่รหัสครูผิด 10 ครั้งจะถูกล็อก 15 นาที
- ภารกิจปลดล็อกตามลำดับ — จะทดสอบภารกิจ 3 ต้องผ่าน 1 และ 2 ก่อน
- ล้างข้อมูลทดสอบในเครื่อง: ปิดเซิร์ฟเวอร์แล้วลบโฟลเดอร์ `backend/data` (ไม่กระทบเว็บจริง)
- บนเว็บจริง ลบบัญชีทดสอบได้จากปุ่ม "ลบ" ในหน้าครู

---

## 6. ⚠️ ก่อน push — เว็บจริงจะเปลี่ยนตาม

Render ดึงโค้ดจาก `main` ไป deploy ใหม่ทุกครั้งที่ push ถ้า push โค้ดที่พัง **เว็บที่อาจารย์ใช้จะพังด้วย**

ก่อน push ทุกครั้ง:

```bash
npm test
```

ต้องขึ้น `fail 0` แล้วลองเปิดเว็บในเครื่องไล่ดูอย่างน้อย:

- [ ] ล็อกอินผู้เรียนได้ / ไม่มี error สีแดงใน Console (F12)
- [ ] ลากอุปกรณ์ ต่อสาย กด "ทดสอบเครือข่าย" ได้
- [ ] เปิด Mission Control, Terminal, Network Utility ได้
- [ ] หน้าครูเข้าได้

**ใกล้วันพรีเซนต์ (4 พ.ย. 09:00) ให้หยุดแก้ฟีเจอร์ใหญ่ อย่างน้อยวันก่อนหน้า** — แก้แค่หน้าตาเล็ก ๆ ที่ทดสอบแล้ว

---

## 7. ข้อห้ามสำหรับคนแต่งหน้าบ้าน (สำคัญ)

JavaScript หาองค์ประกอบในหน้าจากชื่อพวกนี้ **ถ้าเปลี่ยนชื่อหรือลบทิ้ง ปุ่มจะกดไม่ติดโดยไม่มี error ให้เห็น**
แก้สี ขนาด ตำแหน่ง ฟอนต์ ใน CSS ได้เต็มที่ แต่ **ห้ามเปลี่ยนชื่อ** รายการต่อไปนี้ใน HTML/JS:

**id** (ใน `index.html` / `teacher.html`):
`desktop` `windowLayer` `dialog` `dialogTitle` `dialogBody` `toast` `clock` `wifiStatus` `assistantDock` `minimizedArea`
`loginScreen` `loginForm` `loginFields` `loginStatus` `loginId` `loginName` `loginBtn` `idWarn`
`loginCard` `teacherForm` `tPass` `kbWarn` `loginError` `report` `kpis` `studentTable` `studentNote` `surveyTable` `comments` `mistakes` `barActions` `refreshBtn` `logoutBtn`

**class**:
`workspace` `titlebar` `window-title` `close` `min` `max` `test-window` `mission-check` `canvas` `canvas-scene` `canvas-tip` `wires` `wire` `marker-layer`
`node` `node-name` `node-ip` `port` `product` `resize-device` `note` `side-device` `selected` `empty` `delete` `mission-panel` `mp-brief` `mp-lesson`
`dropdown` `dialog-actions` `link-actions` `finder-row` `nu-tabs` `explain`

**data-\***:
`data-menu` `data-cmd` `data-cmd2` `data-dock` `data-tool` `data-field` `data-for` `data-size` `data-count` `data-id` `data-open` `data-action`
`data-net-status` `data-device-status` `data-wifi-settings` `data-link-index` `data-mission` `data-lesson` `data-del` `data-q`

**class ที่ JavaScript เติม/ถอดเพื่อบอกสถานะ** — แต่งหน้าตาได้ แต่ต้องมีอยู่ใน CSS:
`show` `open` `active` `minimized` `maximized` `st-error` `st-warning` `pulse-node` `wifi-on` `packet` `packet-hop` `packet-fail`
`on` `locked` `passed` `read` `right` `wrong` `answer` `confirm` `primary-btn` `danger-btn`

> ถ้าอยากเปลี่ยนชื่อจริง ๆ ต้องค้นใน `frontend/js/` แล้วแก้ทุกที่ให้ตรงกัน — คุยกับคนทำหลังบ้านก่อน

---

## 8. ไฟล์ไหนทำอะไร

| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/index.html` | หน้าหลักผู้เรียน (เมนู, Dock, หน้าล็อกอิน) |
| `frontend/css/style.css` | หน้าตาเดิมของ Net Desktop |
| `frontend/css/cai.css` | หน้าตาส่วนที่เพิ่ม: ล็อกอิน, Inspector, ภารกิจ, บทเรียน, แบบทดสอบ, Terminal, Network Utility |
| `frontend/css/yosemite.css` | Theme หลัก, Desktop, Workspace และ Dock |
| `frontend/css/desktop-windows.css`, `knowledge-browser.css`, `navi.css` | CSS ของหน้าต่างและแต่ละแอป |
| `frontend/js/app.js` | Desktop, หน้าต่าง Workspace, ลากอุปกรณ์, ต่อสาย |
| `frontend/js/desktop-window.js` | shell หน้าต่างแอปและการย่อเข้า Dock |
| `frontend/js/knowledge-browser.js` | Net Encyclopedia และระบบค้นหา |
| `frontend/js/navi.js` | UI และกฎถามตอบของ Navi |
| `frontend/js/cai.js` | ต่อกับหลังบ้าน: ล็อกอิน, บันทึก, ภารกิจ, แบบทดสอบ, Terminal |
| `frontend/js/api.js` | รายการคำสั่งเรียก API |
| `frontend/teacher.html`, `css/teacher.css`, `js/teacher.js` | หน้าครู |
| `backend/src/content/` | **เนื้อหา**: บทเรียน (`lessons.js`), ภารกิจ (`missions.js`), ข้อสอบ/แบบประเมิน (`quizzes.js`) |
| `backend/src/engine/` | ตัวจำลองเครือข่าย (IP, DHCP, DNS, Wi-Fi, ping) |

รายละเอียด dependency และ public API ของแต่ละโมดูลอยู่ที่ `docs/FRONTEND-ARCHITECTURE.md`
| `docs/API.md`, `docs/DATA-FORMAT.md` | รายการ API และรูปแบบข้อมูล |
| `docs/DEPLOY.md` | วิธีขึ้น Host (Render + Turso) |

---

## 9. ปัญหาที่เจอบ่อย

| อาการ | วิธีแก้ |
|---|---|
| `npm start` ขึ้นว่า **พอร์ต 3000 ถูกใช้งานอยู่** | มีเซิร์ฟเวอร์เปิดค้างอีกหน้าต่าง → ปิดอันเก่า (`Ctrl + C`) หรือเข้า <http://localhost:3000> ได้เลย |
| หน้าเว็บขึ้น "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" | ยังไม่ได้ `npm start` หรือเปิดไฟล์ HTML ตรง ๆ |
| `npm start` ขึ้น `Cannot find module` | ยังไม่ได้ `npm run setup` หลัง pull |
| แก้ CSS แล้วไม่เปลี่ยน | กด `Ctrl + F5` (รีเฟรชแบบล้างแคช) |
| ล็อกอินครูไม่ได้ | แป้นพิมพ์เป็นภาษาไทย / Caps Lock / ถูกล็อกเพราะผิด 10 ครั้ง (รอ 15 นาที) |
| เว็บจริงบน Render เปิดช้ามาก | เว็บหลับเพราะไม่มีคนเข้า 15 นาที รอประมาณ 1 นาทีจะตื่น |
| `git push` ขึ้น rejected | `git pull` ก่อนแล้ว push ใหม่ |
