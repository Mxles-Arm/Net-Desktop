'use strict';
const os = require('os');
const { open, DB_FILE } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const db = open();
const app = createApp(db);

const server = app.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`);
  console.log(`CAI Net พร้อมใช้งานที่ http://localhost:${PORT}`);
  if (lan.length) console.log(`เครื่องอื่นในวง LAN เดียวกันเข้าได้ที่: ${lan.join(', ')}`);
  console.log(`หน้าครู: http://localhost:${PORT}/teacher.html`);
  console.log(`ฐานข้อมูล: ${DB_FILE}`);
  if (!process.env.TEACHER_PASSWORD) console.log('รหัสผ่านครูเริ่มต้น: teacher1234 (เปลี่ยนได้ด้วยตัวแปร TEACHER_PASSWORD)');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nพอร์ต ${PORT} ถูกใช้งานอยู่ — อาจเปิด CAI Net ค้างไว้อีกหน้าต่างหนึ่งแล้ว`);
    console.error(`ถ้าเปิดอยู่แล้ว เข้า http://localhost:${PORT} ได้เลย หรือปิดหน้าต่างเดิม (Ctrl + C) แล้วรันใหม่`);
    console.error('หรือใช้พอร์ตอื่น เช่น  set PORT=3001  แล้ว  npm start\n');
  } else {
    console.error(err);
  }
  db.close();
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { db.close(); process.exit(0); });
