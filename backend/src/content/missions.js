'use strict';
// Missions shown in Mission Control. Each check receives a context with the analysed network
// and returns true/false. The starting workspace (template) is copied for the learner.
const engine = require('../engine/network');

const dev = (id, type, name, x, y, extra = {}) => ({ id, type, name, x, y, w: 110, h: 88, ...extra });
const cable = (a, b) => ({ a, b, kind: 'cable' });

// Helpers over the context { ws, analysis, net }.
const ofType = (c, type) => c.net.nodes.filter((n) => n.type === type);
const cfg = (c, n) => c.net.config.get(n.id);
const hasLink = (c, id, kind) => c.net.links.some((l) => l.ok && (!kind || l.kind === kind) && (l.a === id || l.b === id));
const pingOk = (c, from, to) => engine.ping(c.ws, from.id, to.id, 1, c.net).ok;
const router = (c) => ofType(c, 'router').find((r) => cfg(c, r).valid);
const noErrors = (c) => c.analysis.ok;

const MISSIONS = [
  {
    id: 'lan-basic',
    order: 1,
    title: 'เชื่อมต่อ LAN ภายในห้องเรียน',
    summary: 'สร้างเครือข่ายแบบใช้สายให้ Computer 3 เครื่องคุยกับ Router ได้',
    story: 'ห้องเรียนใหม่มี Router อยู่แล้ว 1 ตัว ให้ติดตั้ง Switch และ Computer อย่างน้อย 3 เครื่อง ต่อสาย LAN ให้ครบ แล้วตั้ง IP ให้ทุกเครื่องอยู่วงเดียวกับ Router (192.168.1.x) โดยใช้ Router เป็น Default Gateway',
    allowed: ['router', 'switch', 'pc'],
    quiz: 'm-lan-basic',
    template: {
      nodes: [dev('r1', 'router', 'Router ห้องเรียน', 260, 40, { ip: '192.168.1.1', mask: '255.255.255.0', dhcpServer: false })],
      links: [],
    },
    checks: [
      { id: 'switch', label: 'มี Switch อย่างน้อย 1 ตัว', test: (c) => ofType(c, 'switch').length >= 1 },
      { id: 'pcs', label: 'มี Computer อย่างน้อย 3 เครื่อง', test: (c) => ofType(c, 'pc').length >= 3 },
      { id: 'uplink', label: 'Router ต่อสาย LAN กับ Switch', test: (c) => c.net.links.some((l) => l.kind === 'cable' && [l.a, l.b].some((id) => c.net.byId.get(id).type === 'router') && [l.a, l.b].some((id) => c.net.byId.get(id).type === 'switch')) },
      { id: 'wired', label: 'Computer ทุกเครื่องเชื่อมด้วยสาย LAN', test: (c) => ofType(c, 'pc').length > 0 && ofType(c, 'pc').every((p) => hasLink(c, p.id, 'cable')) },
      { id: 'gateway', label: 'Computer ทุกเครื่องตั้ง Default Gateway เป็น IP ของ Router', test: (c) => { const r = router(c); return !!r && ofType(c, 'pc').length > 0 && ofType(c, 'pc').every((p) => cfg(c, p).gateway === cfg(c, r).ip); } },
      { id: 'clean', label: 'ไม่มีข้อผิดพลาดในเครือข่าย (IP ไม่ซ้ำ ถูกวง)', test: noErrors },
      { id: 'ping', label: 'Computer ทุกเครื่อง Ping ถึง Router ได้', test: (c) => { const r = router(c); return !!r && ofType(c, 'pc').length > 0 && ofType(c, 'pc').every((p) => pingOk(c, p, r)); } },
    ],
  },
  {
    id: 'wifi-lab',
    order: 2,
    title: 'สร้าง Wi-Fi สำหรับห้องคอมพิวเตอร์',
    summary: 'ติดตั้ง Access Point ให้ Notebook เข้าถึง Server ผ่าน Wi-Fi',
    story: 'ห้องคอมพิวเตอร์มี Router, Switch และ Server แล้ว ให้เพิ่ม Access Point ต่อสายเข้ากับ Switch ตั้งชื่อ Wi-Fi เป็น "CAI-Lab" พร้อมรหัสผ่านอย่างน้อย 8 ตัวอักษร จากนั้นให้ Notebook อย่างน้อย 2 เครื่องเชื่อม Wi-Fi และ Ping ถึง Server ได้',
    allowed: ['access', 'laptop'],
    quiz: 'm-wifi-lab',
    template: {
      nodes: [
        dev('r1', 'router', 'Router หลัก', 80, 40, { ip: '192.168.1.1', mask: '255.255.255.0', wifi: false, ssid: '', dhcpServer: true }),
        dev('s1', 'switch', 'Switch ห้องแล็บ', 260, 40, { ip: '' }),
        dev('srv', 'server', 'File Server', 440, 40, { ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.1', dns: '192.168.1.1' }),
      ],
      links: [cable('r1', 's1'), cable('s1', 'srv')],
    },
    checks: [
      { id: 'ap', label: 'มี Access Point ต่อสาย LAN เข้ากับเครือข่าย', test: (c) => ofType(c, 'access').some((a) => hasLink(c, a.id, 'cable')) },
      { id: 'ssid', label: 'Access Point ใช้ชื่อ Wi-Fi (SSID) ว่า CAI-Lab', test: (c) => ofType(c, 'access').some((a) => a.wifi && a.ssid === 'CAI-Lab') },
      { id: 'password', label: 'ตั้งรหัสผ่าน Wi-Fi ใหม่ (ไม่ใช่ค่าเริ่มต้น) อย่างน้อย 8 ตัวอักษร', test: (c) => ofType(c, 'access').some((a) => a.ssid === 'CAI-Lab' && a.password.length >= 8 && a.password !== engine.DEFAULT_WIFI_PASSWORD) },
      { id: 'clients', label: 'Notebook อย่างน้อย 2 เครื่องเชื่อม Wi-Fi กับ Access Point', test: (c) => ofType(c, 'laptop').filter((l) => c.net.links.some((k) => k.ok && k.kind === 'wireless' && [k.a, k.b].includes(l.id) && [k.a, k.b].some((id) => c.net.byId.get(id).type === 'access'))).length >= 2 },
      { id: 'clean', label: 'ไม่มีข้อผิดพลาดในเครือข่าย', test: noErrors },
      { id: 'ping', label: 'Notebook ทุกเครื่อง Ping ถึง File Server ได้', test: (c) => { const s = c.net.byId.get('srv'); return !!s && ofType(c, 'laptop').length >= 2 && ofType(c, 'laptop').every((l) => pingOk(c, l, s)); } },
    ],
  },
  {
    id: 'fix-ip',
    order: 3,
    title: 'แก้ปัญหา IP Address ซ้ำและตั้งค่าผิด',
    summary: 'หาเครื่องที่ตั้งค่าผิดแล้วแก้ให้ทุกเครื่องคุยกันได้',
    story: 'มีคนแจ้งว่าบางเครื่องในห้องใช้อินเทอร์เน็ตไม่ได้ ให้ใช้ปุ่ม "ทดสอบเครือข่าย" และเครื่องมือ Ping หาเครื่องที่ตั้งค่าผิด แล้วแก้ไขให้ทุกเครื่อง Ping ถึงกันได้ (ห้ามลบเครื่องทิ้ง)',
    allowed: [],
    quiz: 'm-fix-ip',
    template: {
      nodes: [
        dev('r1', 'router', 'Router', 260, 30, { ip: '192.168.1.1', mask: '255.255.255.0', dhcpServer: false }),
        dev('s1', 'switch', 'Switch', 260, 170, { ip: '' }),
        dev('p1', 'pc', 'PC-01', 40, 320, { ip: '192.168.1.11', mask: '255.255.255.0', gateway: '192.168.1.1' }),
        dev('p2', 'pc', 'PC-02', 160, 320, { ip: '192.168.1.12', mask: '255.255.255.0', gateway: '192.168.1.1' }),
        dev('p3', 'pc', 'PC-03', 280, 320, { ip: '192.168.1.12', mask: '255.255.255.0', gateway: '192.168.1.1' }),
        dev('p4', 'pc', 'PC-04', 400, 320, { ip: '192.168.1.14', mask: '255.255.255.0', gateway: '192.168.2.1' }),
        dev('p5', 'pc', 'PC-05', 520, 320, { ip: '192.168.10.15', mask: '255.255.255.0', gateway: '192.168.1.1' }),
      ],
      links: [cable('r1', 's1'), cable('s1', 'p1'), cable('s1', 'p2'), cable('s1', 'p3'), cable('s1', 'p4'), cable('s1', 'p5')],
    },
    checks: [
      { id: 'keep', label: 'Computer ยังอยู่ครบ 5 เครื่อง', test: (c) => ['p1', 'p2', 'p3', 'p4', 'p5'].every((id) => c.net.byId.get(id)?.type === 'pc') },
      { id: 'dup', label: 'ไม่มี IP Address ซ้ำกัน', test: (c) => !c.analysis.issues.some((i) => i.code === 'DUPLICATE_IP') },
      { id: 'subnet', label: 'ทุกเครื่องอยู่วงเครือข่ายเดียวกับ Router', test: (c) => !c.analysis.issues.some((i) => ['SUBNET_MISMATCH', 'INVALID_IP', 'INVALID_MASK', 'RESERVED_IP'].includes(i.code)) },
      { id: 'gateway', label: 'Default Gateway ของทุกเครื่องถูกต้อง', test: (c) => { const r = router(c); return !!r && ofType(c, 'pc').every((p) => cfg(c, p).gateway === cfg(c, r).ip); } },
      { id: 'clean', label: 'ไม่มีข้อผิดพลาดในเครือข่าย', test: noErrors },
      { id: 'ping', label: 'ทุกเครื่อง Ping ถึงกันและถึง Router ได้', test: (c) => { const r = router(c); const pcs = ofType(c, 'pc'); return !!r && pcs.length >= 5 && pcs.every((a) => pingOk(c, a, r) && pcs.every((b) => a === b || pingOk(c, a, b))); } },
    ],
  },
  {
    id: 'dhcp-server',
    order: 4,
    title: 'ทุกเครื่อง Ping ถึง Server ด้วย DHCP',
    summary: 'ใช้ DHCP แจก IP อัตโนมัติ และตั้ง Server ให้เรียกด้วยชื่อได้',
    story: 'ครูอยากให้นักเรียนเสียบสายแล้วใช้งานได้ทันที ให้เปลี่ยน Computer ทุกเครื่องเป็น DHCP (รับ IP อัตโนมัติจาก Router) ส่วน File Server ต้องตั้ง IP เอง (Static) เช่น 192.168.1.10 แล้วตรวจว่าทุกเครื่อง Ping ถึง Server และค้นหาด้วยชื่อ file-server ได้ (ลองคำสั่ง nslookup file-server ใน Terminal)',
    allowed: ['pc', 'switch'],
    quiz: 'm-dhcp-server',
    template: {
      nodes: [
        dev('r1', 'router', 'Router', 260, 30, { ip: '192.168.1.1', mask: '255.255.255.0', dhcpServer: true, dhcpStart: 100 }),
        dev('s1', 'switch', 'Switch', 260, 170, { ip: '' }),
        dev('srv', 'server', 'File Server', 480, 170, { ip: '', mask: '255.255.255.0' }),
        dev('p1', 'pc', 'PC-01', 80, 320, { ip: '10.0.0.5', mask: '255.255.255.0' }),
        dev('p2', 'pc', 'PC-02', 260, 320, { ip: '', mask: '255.255.255.0' }),
        dev('p3', 'pc', 'PC-03', 440, 320, { ip: '192.168.1.50', mask: '255.255.255.0' }),
      ],
      links: [cable('r1', 's1'), cable('s1', 'srv'), cable('s1', 'p1'), cable('s1', 'p2'), cable('s1', 'p3')],
    },
    checks: [
      { id: 'static', label: 'File Server ใช้ IP แบบกำหนดเอง (Static) ที่ถูกต้อง', test: (c) => { const s = c.net.byId.get('srv'); return !!s && !s.dhcp && cfg(c, s).valid; } },
      { id: 'dhcp', label: 'Computer ทุกเครื่องรับ IP อัตโนมัติ (DHCP)', test: (c) => ofType(c, 'pc').length >= 3 && ofType(c, 'pc').every((p) => cfg(c, p).source === 'dhcp') },
      { id: 'clean', label: 'ไม่มีข้อผิดพลาดในเครือข่าย', test: noErrors },
      { id: 'ping', label: 'Computer ทุกเครื่อง Ping ถึง File Server ได้', test: (c) => { const s = c.net.byId.get('srv'); return !!s && ofType(c, 'pc').length > 0 && ofType(c, 'pc').every((p) => pingOk(c, p, s)); } },
      { id: 'dns', label: 'Computer ทุกเครื่องค้นหา file-server ด้วยชื่อได้ (DNS)', test: (c) => { const s = c.net.byId.get('srv'); return !!s && ofType(c, 'pc').length > 0 && ofType(c, 'pc').every((p) => engine.resolve(c.net, p.id, engine.hostnameOf(s)).ok); } },
    ],
  },
];

function runChecks(mission, ws) {
  const net = engine.build(ws);
  const analysis = engine.analyze(ws);
  const ctx = { ws, net, analysis };
  const results = mission.checks.map((ch) => {
    let pass = false;
    try { pass = !!ch.test(ctx); } catch { pass = false; }
    return { id: ch.id, label: ch.label, pass };
  });
  return { passed: results.every((r) => r.pass), results, analysis };
}

const publicMission = (m) => ({
  id: m.id, order: m.order, title: m.title, summary: m.summary, story: m.story, allowed: m.allowed, quiz: m.quiz,
  checks: m.checks.map((c) => ({ id: c.id, label: c.label })),
});

module.exports = { MISSIONS, runChecks, publicMission, byId: (id) => MISSIONS.find((m) => m.id === id) };
