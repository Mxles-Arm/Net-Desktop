# Frontend Architecture

หน้าบ้านเป็น HTML/CSS/JavaScript แบบไม่ใช้ build tool ทุกไฟล์โหลดตามลำดับใน `frontend/index.html` และสื่อสารกันผ่าน public API บน `window` เท่าที่จำเป็น

## ลำดับการโหลด

1. `api.js` — ตัวเรียก backend (`api.*`)
2. `app.js` — Desktop, Workspace, อุปกรณ์ และ hook ของระบบเดิม
3. `desktop-window.js` — หน้าต่างแอปแบบแดง–เหลือง–เขียว
4. `knowledge-browser.js` — Net Encyclopedia และ search index
5. `navi.js` — หน้าต่าง/กฎถามตอบของ Navi
6. `cai.js` — login, save, mission, quiz, utility และเชื่อม session ให้ Navi

อย่าสลับลำดับโดยไม่ตรวจ dependency ด้านล่าง

## Public contracts

| API | เจ้าของ | ผู้ใช้ |
|---|---|---|
| `window.DesktopWindows.open(options)` | `desktop-window.js` | Knowledge Browser, Navi |
| `window.DesktopWindows.renderMinimized(area)` | `desktop-window.js` | Dock ใน `app.js` |
| `window.NetKnowledge.open(query?)` | `knowledge-browser.js` | Dock, Help menu, Navi |
| `window.NetKnowledge.search(query)` | `knowledge-browser.js` | Navi |
| `window.NaviAssistant.open(workspace, user)` | `navi.js` | `cai.js` |
| `window.CAI.*` | `cai.js` | `app.js` |

`app.js` ยังเปิด `window.syncMinimizedDock` และ `window.nextDesktopZ` ให้ shell ของหน้าต่างใช้งาน หลีกเลี่ยงการเพิ่ม global ใหม่ถ้าส่ง dependency ผ่าน argument ได้

## CSS ownership

| ไฟล์ | ขอบเขต |
|---|---|
| `style.css` | layout และหน้าตาดั้งเดิมที่เป็น baseline |
| `cai.css` | login, mission, quiz, terminal และส่วน CAI เดิม |
| `yosemite.css` | theme/tokens, Desktop, Workspace, Dock และส่วนกลาง |
| `desktop-windows.css` | shell หน้าต่างแอปที่ลาก/ย่อ/ขยายได้ |
| `knowledge-browser.css` | Net Encyclopedia เท่านั้น |
| `navi.css` | Navi เท่านั้น |

ไฟล์ feature โหลดหลัง `yosemite.css` เพื่อให้ override เฉพาะ feature โดยไม่ใช้ `!important` เกินจำเป็น

## เพิ่มแอปเดสก์ท็อปใหม่

```js
const app = window.DesktopWindows.open({
  id: "unique-id",
  title: "ชื่อหน้าต่าง",
  icon: "app",
  width: 720,
  height: 520,
  content: `<div class="my-app">...</div>`,
});

if (!app.initialized) {
  app.initialized = true;
  // bind event ภายใน app.body เท่านั้น เพื่อไม่ชน id ของหน้าต่างอื่น
}
```

ใช้ `app.body.querySelector(...)` แทน `document.querySelector(...)` สำหรับ element ภายในหน้าต่าง

## จุดที่ควรระวัง

- ห้ามเปลี่ยน hook ในรายการข้อ 7 ของ `TEAM-GUIDE.md` โดยไม่ค้น usage ทุกไฟล์
- ข้อความจากผู้ใช้ต้องใส่ด้วย `textContent` หรือ escape ก่อนใส่ `innerHTML`
- Navi วิเคราะห์ Workspace ผ่าน `/api/assistant/hint`; อย่าทำให้คำตอบ frontend ขัดกับ Network Engine
- Knowledge Browser ต้องแสดง core articles ได้ทันที แม้ API บทเรียนช้าหรือ offline
- ปิด/ย่อ/ขยายหน้าต่างต้องผ่าน `DesktopWindows` เพื่อให้ Dock sync ถูกต้อง

## ตรวจงานก่อนส่ง

```bash
npm test
node --check frontend/js/app.js
node --check frontend/js/desktop-window.js
node --check frontend/js/knowledge-browser.js
node --check frontend/js/navi.js
node --check frontend/js/cai.js
```

จากนั้น smoke test: login, Workspace, Packet, Knowledge Browser, Navi, logout และหน้าครู
