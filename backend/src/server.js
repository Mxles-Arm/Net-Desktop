'use strict';
const os = require('os');
const { open, DB_FILE } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const db = open();
const app = createApp(db);

app.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`);
  console.log(`CAI Net พร้อมใช้งานที่ http://localhost:${PORT}`);
  if (lan.length) console.log(`เครื่องอื่นในวง LAN เดียวกันเข้าได้ที่: ${lan.join(', ')}`);
  console.log(`หน้าครู: http://localhost:${PORT}/teacher.html`);
  console.log(`ฐานข้อมูล: ${DB_FILE}`);
  if (!process.env.TEACHER_PASSWORD) console.log('รหัสผ่านครูเริ่มต้น: teacher1234 (เปลี่ยนได้ด้วยตัวแปร TEACHER_PASSWORD)');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { db.close(); process.exit(0); });
