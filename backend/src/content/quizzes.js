'use strict';
// Question banks. `answer` is the index of the correct choice and never leaves the server
// until the learner submits.

const CORE = [
  { id: 'q1', q: 'อุปกรณ์ใดทำหน้าที่เชื่อมต่อคอมพิวเตอร์หลายเครื่องภายใน LAN ด้วยสาย?', choices: ['Router', 'Switch', 'Access Point', 'Server'], answer: 1, explain: 'Switch รับเฟรมแล้วส่งต่อไปยังพอร์ตของเครื่องปลายทางโดยดูจาก MAC Address จึงใช้เชื่อมเครื่องหลายเครื่องใน LAN เดียวกัน' },
  { id: 'q2', q: 'อุปกรณ์ใดเชื่อมต่อระหว่างเครือข่ายและมักทำหน้าที่เป็น Default Gateway?', choices: ['Switch', 'Notebook', 'Router', 'Access Point'], answer: 2, explain: 'Router เลือกเส้นทางส่งข้อมูลข้ามเครือข่าย เครื่องในห้องจึงตั้ง Default Gateway เป็น IP ของ Router' },
  { id: 'q3', q: 'ข้อใดเป็น IP Address (IPv4) ที่ถูกต้อง?', choices: ['192.168.1.256', '192.168.1', '192.168.1.25', '300.1.1.1'], answer: 2, explain: 'IPv4 มีตัวเลข 4 ชุด แต่ละชุดมีค่า 0–255 ข้ออื่นมีชุดที่เกิน 255 หรือมีไม่ครบ 4 ชุด' },
  { id: 'q4', q: 'เครื่องที่มี IP 192.168.1.10 และ Subnet Mask 255.255.255.0 อยู่วงเครือข่ายเดียวกับ IP ใด?', choices: ['192.168.2.10', '192.168.1.200', '10.0.0.10', '192.169.1.10'], answer: 1, explain: 'Mask 255.255.255.0 (/24) หมายถึงเลข 3 ชุดแรกต้องเหมือนกัน คือ 192.168.1.x' },
  { id: 'q5', q: 'ถ้าคอมพิวเตอร์ 2 เครื่องตั้ง IP Address เดียวกัน จะเกิดอะไรขึ้น?', choices: ['เครือข่ายเร็วขึ้น', 'เกิด IP Conflict ข้อมูลไปผิดเครื่องหรือใช้งานไม่ได้', 'Router แก้ให้อัตโนมัติเสมอ', 'ไม่มีผลใด ๆ'], answer: 1, explain: 'IP ต้องไม่ซ้ำกันในเครือข่าย ถ้าซ้ำ อุปกรณ์อื่นจะไม่รู้ว่าต้องส่งข้อมูลไปเครื่องไหน เรียกว่า IP Conflict' },
  { id: 'q6', q: 'DHCP มีหน้าที่อะไร?', choices: ['แปลงชื่อเว็บไซต์เป็น IP', 'แจก IP Address และค่าเครือข่ายให้เครื่องลูกข่ายอัตโนมัติ', 'กระจายสัญญาณ Wi-Fi', 'ป้องกันไวรัส'], answer: 1, explain: 'DHCP Server (มักอยู่ใน Router) แจก IP, Subnet Mask, Default Gateway และ DNS ให้เครื่องที่ตั้งค่าเป็น "รับอัตโนมัติ"' },
  { id: 'q7', q: 'DNS มีหน้าที่อะไร?', choices: ['แปลงชื่อเครื่องหรือชื่อเว็บไซต์เป็น IP Address', 'แจก IP อัตโนมัติ', 'เชื่อมสาย LAN', 'วัดความแรงสัญญาณ'], answer: 0, explain: 'DNS ทำหน้าที่เหมือนสมุดโทรศัพท์ เปลี่ยนชื่อที่คนจำง่าย (เช่น file-server) ให้เป็น IP ที่เครื่องใช้สื่อสารกัน' },
  { id: 'q8', q: 'คำสั่งใดใช้ทดสอบว่าเครื่องของเราติดต่อกับเครื่องปลายทางได้หรือไม่?', choices: ['ipconfig', 'ping', 'hostname', 'cls'], answer: 1, explain: 'ping ส่ง Packet ไปยังปลายทางแล้วรอการตอบกลับ ถ้ามี Reply แสดงว่าติดต่อกันได้' },
  { id: 'q9', q: 'Access Point มีหน้าที่อะไร?', choices: ['เก็บไฟล์ของเครือข่าย', 'กระจายสัญญาณ Wi-Fi และเชื่อมอุปกรณ์ไร้สายเข้ากับ LAN', 'แจกไฟฟ้าให้อุปกรณ์', 'เปลี่ยน IP เป็นชื่อ'], answer: 1, explain: 'Access Point รับ-ส่งข้อมูลแบบไร้สายกับ Notebook แล้วส่งต่อเข้าสาย LAN จึงต้องต่อสายเข้ากับ Switch หรือ Router' },
  { id: 'q10', q: 'Default Gateway ของคอมพิวเตอร์ควรตั้งเป็นค่าใด?', choices: ['IP ของเครื่องตัวเอง', 'IP ของ Router ที่อยู่วงเครือข่ายเดียวกัน', 'IP ใดก็ได้', '255.255.255.0'], answer: 1, explain: 'Default Gateway คือประตูออกนอกวงเครือข่าย ต้องเป็น IP ของ Router ที่อยู่วงเดียวกับเครื่อง' },
];

// Posttest uses the same items in a different order (parallel form).
const POST_ORDER = ['q4', 'q1', 'q7', 'q10', 'q3', 'q6', 'q9', 'q2', 'q8', 'q5'];

const QUIZZES = {
  pretest: { id: 'pretest', title: 'แบบทดสอบก่อนเรียน', kind: 'test', questions: CORE },
  posttest: { id: 'posttest', title: 'แบบทดสอบหลังเรียน', kind: 'test', questions: POST_ORDER.map((id) => CORE.find((q) => q.id === id)) },
  'm-lan-basic': {
    id: 'm-lan-basic', title: 'คำถามหลังภารกิจ: LAN ภายในห้องเรียน', kind: 'exercise',
    questions: [
      { id: 'a1', q: 'ในภารกิจนี้ Switch ทำหน้าที่อะไร?', choices: ['แจก IP ให้ทุกเครื่อง', 'เป็นจุดรวมสาย LAN ส่งข้อมูลระหว่างเครื่องในห้อง', 'กระจาย Wi-Fi', 'แปลงชื่อเป็น IP'], answer: 1, explain: 'Switch เป็นศูนย์กลางของสาย LAN ทุกเครื่องเสียบสายเข้าที่ Switch แล้ว Switch ส่งข้อมูลไปยังพอร์ตที่ถูกต้อง' },
      { id: 'a2', q: 'PC ที่ยังไม่ได้ตั้ง Default Gateway จะ Ping ถึง Router (192.168.1.1) ที่อยู่วงเดียวกันได้หรือไม่?', choices: ['ได้ เพราะอยู่วงเดียวกัน ไม่ต้องผ่าน Gateway', 'ไม่ได้ ต้องมี Gateway เสมอ', 'ได้เฉพาะผ่าน Wi-Fi', 'ไม่ได้ เพราะ Switch จะบล็อก'], answer: 0, explain: 'เครื่องในวงเดียวกันคุยกันได้ตรง ๆ ผ่าน Switch Gateway จำเป็นเมื่อต้องส่งข้อมูลออกนอกวงเครือข่าย' },
    ],
  },
  'm-wifi-lab': {
    id: 'm-wifi-lab', title: 'คำถามหลังภารกิจ: Wi-Fi ห้องคอมพิวเตอร์', kind: 'exercise',
    questions: [
      { id: 'b1', q: 'ทำไม Access Point ต้องต่อสาย LAN เข้ากับ Switch?', choices: ['เพื่อรับไฟฟ้าเท่านั้น', 'เพื่อให้เครื่องที่ต่อ Wi-Fi เข้าถึงอุปกรณ์อื่นในเครือข่ายสายได้', 'ไม่จำเป็นต้องต่อ', 'เพื่อเปลี่ยนชื่อ SSID'], answer: 1, explain: 'ถ้าไม่ต่อสาย Access Point จะเป็นเครือข่ายเกาะแยก Notebook จะเข้าถึง Server หรือ Router ไม่ได้' },
      { id: 'b2', q: 'SSID คืออะไร?', choices: ['รหัสผ่าน Wi-Fi', 'ชื่อของเครือข่าย Wi-Fi', 'IP ของ Access Point', 'ความเร็วของ Wi-Fi'], answer: 1, explain: 'SSID คือชื่อเครือข่ายไร้สายที่เราเห็นตอนเลือก Wi-Fi เครื่องลูกข่ายต้องเลือก SSID และใส่รหัสผ่านให้ตรงกัน' },
    ],
  },
  'm-fix-ip': {
    id: 'm-fix-ip', title: 'คำถามหลังภารกิจ: แก้ปัญหา IP', kind: 'exercise',
    questions: [
      { id: 'c1', q: 'PC-04 มี IP 192.168.1.14/24 แต่ตั้ง Gateway เป็น 192.168.2.1 ปัญหาคืออะไร?', choices: ['Gateway อยู่คนละวงเครือข่ายกับเครื่อง จึงใช้งานไม่ได้', 'IP ยาวเกินไป', 'ไม่มีปัญหา', 'ต้องใช้ Wi-Fi แทน'], answer: 0, explain: 'Gateway ต้องอยู่วงเดียวกับเครื่อง (192.168.1.x) และควรเป็น IP ของ Router คือ 192.168.1.1' },
      { id: 'c2', q: 'วิธีใดช่วยป้องกันปัญหา IP ซ้ำได้ดีที่สุดในห้องเรียนขนาดใหญ่?', choices: ['ให้ทุกคนตั้ง IP เดียวกัน', 'ใช้ DHCP แจก IP อัตโนมัติ', 'ปิด Router', 'ใช้สาย LAN ที่ยาวขึ้น'], answer: 1, explain: 'DHCP จะแจก IP ที่ไม่ซ้ำกันให้แต่ละเครื่องโดยอัตโนมัติ ลดความผิดพลาดจากการตั้งเอง' },
    ],
  },
  'm-dhcp-server': {
    id: 'm-dhcp-server', title: 'คำถามหลังภารกิจ: DHCP และ DNS', kind: 'exercise',
    questions: [
      { id: 'd1', q: 'ทำไม Server ควรใช้ IP แบบกำหนดเอง (Static)?', choices: ['เพราะเร็วกว่า', 'เพื่อให้ IP ไม่เปลี่ยน เครื่องอื่นจึงหา Server เจอเสมอ', 'เพราะ DHCP ใช้กับ Server ไม่ได้', 'ไม่มีเหตุผล'], answer: 1, explain: 'ถ้า IP ของ Server เปลี่ยนไปเรื่อย ๆ เครื่องลูกข่ายและ DNS จะหา Server ไม่เจอ จึงควรตั้ง IP คงที่' },
      { id: 'd2', q: 'นอกจาก IP Address แล้ว DHCP ส่งค่าใดให้เครื่องลูกข่ายด้วย?', choices: ['Subnet Mask, Default Gateway และ DNS Server', 'รหัสผ่าน Wi-Fi', 'ชื่อผู้ใช้', 'ไฟล์จาก Server'], answer: 0, explain: 'DHCP ส่งค่าเครือข่ายที่จำเป็นครบชุด ทำให้เครื่องใช้งานได้ทันทีโดยไม่ต้องตั้งเอง' },
    ],
  },
};

const SURVEY = {
  scale: ['น้อยที่สุด', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'],
  items: [
    'เนื้อหาบทเรียนเข้าใจง่าย เหมาะกับผู้เรียน',
    'ลำดับของบทเรียนและภารกิจมีความเหมาะสม',
    'การออกแบบหน้าจอสวยงามและใช้งานง่าย',
    'การจำลองอุปกรณ์และการเชื่อมต่อมีความสมจริง',
    'เครื่องมือ Ping / Terminal ช่วยให้เข้าใจการทำงานของเครือข่าย',
    'คำแนะนำจาก Navi ช่วยให้แก้ปัญหาได้',
    'แบบทดสอบและคำอธิบายเฉลยช่วยทบทวนความรู้',
    'ความพึงพอใจโดยรวมต่อบทเรียน CAI Net',
  ],
};

const publicQuiz = (quiz) => ({
  id: quiz.id, title: quiz.title, kind: quiz.kind,
  questions: quiz.questions.map((q) => ({ id: q.id, q: q.q, choices: q.choices })),
});

module.exports = { QUIZZES, SURVEY, publicQuiz };
