'use strict';
// Network Engine: reads a workspace (nodes + links) and behaves like a small classroom LAN.
// Model: every connected group of devices is one Layer-2 segment (switches, access points and the
// router's LAN ports all bridge). Each router has one LAN interface, acts as Default Gateway,
// DHCP server and DNS server for its segment.
const ip = require('./ip');

const HOST_TYPES = ['pc', 'laptop', 'server'];
const AP_TYPES = ['router', 'access'];
const WIFI_CLIENT_TYPES = ['laptop'];
const DEVICE_TYPES = ['router', 'switch', 'pc', 'laptop', 'server', 'access'];
const DEFAULT_MASK = '255.255.255.0';
const DEFAULT_WIFI_PASSWORD = 'classroom123';
const DOMAIN = 'cai.local';
const MAX_NODES = 200;
const MAX_LINKS = 500;

const TYPE_LABEL = {
  router: 'Router', switch: 'Switch', pc: 'Computer', laptop: 'Notebook', server: 'Server', access: 'Access Point',
};

const str = (v, max = 64) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- Normalisation ----------

function normalize(workspace) {
  const src = workspace && typeof workspace === 'object' ? workspace : {};
  const rawNodes = Array.isArray(src.nodes) ? src.nodes.slice(0, MAX_NODES) : [];
  const nodes = [];
  const seen = new Set();
  for (const r of rawNodes) {
    if (!r || typeof r !== 'object') continue;
    const id = str(String(r.id ?? ''), 80);
    const type = DEVICE_TYPES.includes(r.type) ? r.type : null;
    if (!id || !type || seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      type,
      name: str(r.name, 60) || TYPE_LABEL[type],
      ip: str(r.ip, 15),
      mask: str(r.mask, 15) || DEFAULT_MASK,
      gateway: str(r.gateway, 15),
      dns: str(r.dns, 15),
      dhcp: HOST_TYPES.includes(type) && r.dhcp === true,
      wifi: r.wifi === true,
      ssid: str(r.ssid, 32),
      password: typeof r.password === 'string' ? r.password.slice(0, 63) : DEFAULT_WIFI_PASSWORD,
      dhcpServer: type === 'router' ? r.dhcpServer !== false : false,
      dhcpStart: Number.isInteger(r.dhcpStart) && r.dhcpStart >= 2 && r.dhcpStart <= 250 ? r.dhcpStart : 100,
    });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rawLinks = Array.isArray(src.links) ? src.links.slice(0, MAX_LINKS) : [];
  const links = [];
  const linkKeys = new Set();
  for (const l of rawLinks) {
    if (!l || typeof l !== 'object') continue;
    const a = String(l.a ?? ''), b = String(l.b ?? '');
    if (!byId.has(a) || !byId.has(b) || a === b) continue;
    const kind = l.kind === 'wireless' ? 'wireless' : 'cable';
    const key = [a, b].sort().join('|') + '|' + kind;
    if (linkKeys.has(key)) continue;
    linkKeys.add(key);
    links.push({ a, b, kind });
  }
  return { nodes, links, byId };
}

// ---------- Issues ----------

function issue(code, severity, deviceIds, message, hints) {
  return { code, severity, deviceIds, message, hints };
}

// Checks one wireless link. Returns null when it works, otherwise an issue.
function checkWireless(link, byId) {
  const a = byId.get(link.a), b = byId.get(link.b);
  const ids = [a.id, b.id];
  const aIsAp = AP_TYPES.includes(a.type), bIsAp = AP_TYPES.includes(b.type);
  if (aIsAp && bIsAp) {
    return issue('WIFI_AP_TO_AP', 'error', ids, `${a.name} และ ${b.name} เป็นตัวกระจายสัญญาณทั้งคู่ จึงเชื่อม Wi-Fi หากันไม่ได้`, [
      'มีการเชื่อม Wi-Fi ที่ไม่ถูกต้อง',
      `ดูเส้นประระหว่าง ${a.name} กับ ${b.name}`,
      'Router และ Access Point ควรเชื่อมกันด้วยสาย LAN ส่วน Wi-Fi ใช้กับ Notebook',
    ]);
  }
  if (!aIsAp && !bIsAp) {
    return issue('WIFI_NO_AP', 'error', ids, `การเชื่อม Wi-Fi ระหว่าง ${a.name} กับ ${b.name} ไม่มี Router หรือ Access Point เป็นตัวกระจายสัญญาณ`, [
      'มีการเชื่อม Wi-Fi ที่ไม่มีตัวกระจายสัญญาณ',
      `ดูเส้นประระหว่าง ${a.name} กับ ${b.name}`,
      'เชื่อม Notebook เข้ากับ Router ที่เปิด Wi-Fi หรือ Access Point แทน',
    ]);
  }
  const ap = aIsAp ? a : b, client = aIsAp ? b : a;
  if (!WIFI_CLIENT_TYPES.includes(client.type)) {
    return issue('WIFI_CLIENT_UNSUPPORTED', 'error', [client.id], `${client.name} (${TYPE_LABEL[client.type]}) ไม่มีการ์ด Wi-Fi`, [
      'มีอุปกรณ์ที่ใช้ Wi-Fi ไม่ได้แต่ถูกเชื่อมแบบไร้สาย',
      `ตรวจ ${client.name}`,
      `${TYPE_LABEL[client.type]} ต้องใช้สาย LAN ลบเส้นประแล้วใช้เครื่องมือ "เชื่อมสาย" แทน`,
    ]);
  }
  if (!ap.wifi) {
    return issue('WIFI_AP_OFF', 'error', [ap.id], `${ap.name} ปิด Wi-Fi อยู่ ${client.name} จึงเชื่อมต่อไม่ได้`, [
      'มีตัวกระจายสัญญาณที่ปิด Wi-Fi อยู่',
      `ตรวจการตั้งค่า Wi-Fi ของ ${ap.name}`,
      `เปิด "ตั้งค่า Wi-Fi" ของ ${ap.name} แล้วเลือก "เปิด Wi-Fi"`,
    ]);
  }
  if (!client.wifi) {
    return issue('WIFI_CLIENT_OFF', 'error', [client.id], `${client.name} ปิด Wi-Fi อยู่`, [
      'มี Notebook ที่ยังไม่ได้เปิด Wi-Fi',
      `ตรวจ ${client.name}`,
      `เปิด Wi-Fi ของ ${client.name} ในหน้าตั้งค่าเครือข่าย`,
    ]);
  }
  if (client.ssid !== ap.ssid) {
    return issue('WIFI_SSID_MISMATCH', 'error', [client.id, ap.id], `${client.name} เลือก SSID "${client.ssid || '-'}" แต่ ${ap.name} กระจาย "${ap.ssid || '-'}"`, [
      'มีเครื่องที่เลือกชื่อ Wi-Fi ไม่ตรงกับตัวกระจายสัญญาณ',
      `ตรวจ SSID ของ ${client.name}`,
      `ตั้ง SSID ของ ${client.name} ให้เป็น "${ap.ssid}"`,
    ]);
  }
  if (ap.password && client.password !== ap.password) {
    return issue('WIFI_WRONG_PASSWORD', 'error', [client.id], `${client.name} ใส่รหัสผ่าน Wi-Fi ของ "${ap.ssid}" ไม่ถูกต้อง`, [
      'มีเครื่องที่ใส่รหัสผ่าน Wi-Fi ผิด',
      `ตรวจรหัสผ่าน Wi-Fi ของ ${client.name}`,
      `ใส่รหัสผ่านให้ตรงกับที่ตั้งไว้ใน ${ap.name}`,
    ]);
  }
  return null;
}

// Deterministic pseudo MAC address from the device id.
function macOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const bytes = [0x02, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, (h * 31) & 255];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('-');
}

function hostnameOf(n) {
  return n.name.trim().toLowerCase().replace(/\s+/g, '-');
}

// ---------- Build: links → segments → addresses ----------

function build(workspace) {
  const { nodes, links, byId } = normalize(workspace);
  const issues = [];
  const adjacency = new Map(nodes.map((n) => [n.id, []]));
  const linkState = [];

  for (const l of links) {
    const problem = l.kind === 'wireless' ? checkWireless(l, byId) : null;
    if (problem) issues.push(problem);
    linkState.push({ ...l, ok: !problem });
    if (!problem) {
      adjacency.get(l.a).push({ to: l.b, kind: l.kind });
      adjacency.get(l.b).push({ to: l.a, kind: l.kind });
    }
  }

  // Connected segments (only working links count).
  const segmentOf = new Map();
  let segCount = 0;
  for (const n of nodes) {
    if (segmentOf.has(n.id)) continue;
    const queue = [n.id];
    segmentOf.set(n.id, segCount);
    while (queue.length) {
      const cur = queue.shift();
      for (const e of adjacency.get(cur)) {
        if (!segmentOf.has(e.to)) {
          segmentOf.set(e.to, segCount);
          queue.push(e.to);
        }
      }
    }
    segCount++;
  }

  // Static configuration first.
  const config = new Map();
  for (const n of nodes) {
    if (n.dhcp) continue;
    const has = n.ip !== '';
    const valid = has && ip.isValidIp(n.ip) && ip.isValidMask(n.mask) && !ip.hostAddressProblem(n.ip, n.mask);
    config.set(n.id, {
      ip: has ? n.ip : '', mask: n.mask, gateway: n.gateway, dns: n.dns, source: has ? 'static' : 'none', valid,
    });
  }

  // DHCP: the first router with DHCP on in the client's segment hands out addresses.
  const usedIps = new Set([...config.values()].filter((c) => c.valid).map((c) => c.ip));
  const leaseCursor = new Map();
  for (const n of nodes) {
    if (!n.dhcp) continue;
    const seg = segmentOf.get(n.id);
    const servers = nodes.filter((r) => r.type === 'router' && r.dhcpServer && segmentOf.get(r.id) === seg && config.get(r.id)?.valid);
    const server = servers[0];
    if (!server) {
      // Windows falls back to APIPA (169.254.x.x) when no DHCP server answers.
      const mac = macOf(n.id).split('-');
      const apipa = `169.254.${(parseInt(mac[4], 16) % 254) + 1}.${(parseInt(mac[5], 16) % 254) + 1}`;
      config.set(n.id, { ip: apipa, mask: '255.255.0.0', gateway: '', dns: '', source: 'apipa', valid: true });
      issues.push(issue('NO_DHCP_SERVER', 'error', [n.id], `${n.name} ตั้งค่าเป็น DHCP แต่ไม่พบ Router ที่แจก IP ในเครือข่ายเดียวกัน จึงได้ IP ${apipa} (APIPA)`, [
        'มีเครื่องที่ขอ IP อัตโนมัติไม่สำเร็จ',
        `ตรวจ ${n.name} ว่าต่อถึง Router หรือยัง`,
        'เชื่อมเครื่องนี้ให้ถึง Router และเปิด DHCP Server ที่ Router หรือเปลี่ยนเป็นตั้ง IP เอง (Manual)',
      ]));
      continue;
    }
    if (servers.length > 1 && !issues.some((i) => i.code === 'MULTIPLE_DHCP' && i.deviceIds.includes(servers[0].id))) {
      issues.push(issue('MULTIPLE_DHCP', 'warning', servers.map((s) => s.id), `มี DHCP Server มากกว่า 1 ตัวในเครือข่ายเดียวกัน (${servers.map((s) => s.name).join(', ')})`, [
        'มีตัวแจก IP ซ้อนกัน',
        `ตรวจ ${servers.map((s) => s.name).join(', ')}`,
        'ควรเปิด DHCP Server ไว้ที่ Router ตัวเดียว',
      ]));
    }
    const sc = config.get(server.id);
    const network = ip.networkOf(sc.ip, sc.mask), broadcast = ip.broadcastOf(sc.ip, sc.mask);
    let cursor = leaseCursor.get(server.id) ?? network + server.dhcpStart;
    while (cursor < broadcast && usedIps.has(ip.formatIp(cursor))) cursor++;
    if (cursor >= broadcast) {
      config.set(n.id, { ip: '', mask: sc.mask, gateway: '', dns: '', source: 'none', valid: false });
      issues.push(issue('DHCP_POOL_FULL', 'error', [n.id, server.id], `IP ใน DHCP ของ ${server.name} หมดแล้ว`, [
        'ตัวแจก IP แจกหมดแล้ว', `ตรวจ DHCP ของ ${server.name}`, 'ลดค่าเริ่มต้นของช่วงแจก IP หรือใช้ Subnet ที่ใหญ่ขึ้น',
      ]));
      continue;
    }
    const leased = ip.formatIp(cursor);
    usedIps.add(leased);
    leaseCursor.set(server.id, cursor + 1);
    config.set(n.id, { ip: leased, mask: sc.mask, gateway: sc.ip, dns: sc.ip, source: 'dhcp', valid: true, server: server.id });
  }

  return { nodes, links: linkState, byId, adjacency, segmentOf, config, issues };
}

// ---------- Analysis ----------

function analyze(workspace) {
  const net = build(workspace);
  const { nodes, byId, adjacency, segmentOf, config, issues } = net;
  const ipLabel = (n) => `${n.name} (${config.get(n.id).ip})`;

  for (const n of nodes) {
    const c = config.get(n.id);
    const isHost = HOST_TYPES.includes(n.type);
    const linked = net.links.some((l) => l.a === n.id || l.b === n.id);

    if (!linked) {
      issues.push(issue('ISOLATED', isHost ? 'error' : 'warning', [n.id], `${n.name} ยังไม่ได้เชื่อมต่อกับอุปกรณ์ใด`, [
        'มีอุปกรณ์ที่ยังไม่ได้เชื่อมต่อ',
        `ดูที่ ${n.name}`,
        n.type === 'laptop' ? `ใช้ "เชื่อม Wi-Fi" จาก ${n.name} ไปยัง Router หรือ Access Point` : `ลากพอร์ตสีฟ้าของ ${n.name} ไปยัง Switch หรือ Router`,
      ]));
    }
    if (n.type === 'access' && !net.links.some((l) => l.kind === 'cable' && (l.a === n.id || l.b === n.id))) {
      issues.push(issue('AP_NOT_WIRED', 'warning', [n.id], `${n.name} ยังไม่ได้ต่อสาย LAN เข้ากับ Switch หรือ Router เครื่องที่ต่อ Wi-Fi จึงออกไปที่อื่นไม่ได้`, [
        'มี Access Point ที่ยังไม่ได้ต่อสาย',
        `ดูที่ ${n.name}`,
        `ใช้ "เชื่อมสาย" ต่อ ${n.name} เข้ากับ Switch หรือ Router`,
      ]));
    }
    if (n.dhcp) continue; // DHCP clients were checked while leasing.

    if (c.source === 'none') {
      if (isHost || n.type === 'router') {
        issues.push(issue('NO_IP', 'error', [n.id], `${n.name} ยังไม่มี IP Address`, [
          'มีเครื่องที่ยังไม่มี IP Address',
          `เลือก ${n.name} แล้วดูที่ Inspector`,
          n.type === 'router' ? 'ตั้ง IP ให้ Router เช่น 192.168.1.1' : 'ใส่ IP Address หรือเปลี่ยนเป็น DHCP',
        ]));
      }
      continue;
    }
    if (!ip.isValidIp(n.ip)) {
      issues.push(issue('INVALID_IP', 'error', [n.id], `IP Address ของ ${n.name} ("${n.ip}") ไม่ถูกต้อง`, [
        'มี IP Address ที่เขียนผิดรูปแบบ',
        `ตรวจ IP ของ ${n.name}`,
        'IP ต้องเป็นตัวเลข 4 ชุด ชุดละ 0–255 คั่นด้วยจุด เช่น 192.168.1.20',
      ]));
      continue;
    }
    if (!ip.isValidMask(n.mask)) {
      issues.push(issue('INVALID_MASK', 'error', [n.id], `Subnet Mask ของ ${n.name} ("${n.mask}") ไม่ถูกต้อง`, [
        'มี Subnet Mask ที่ไม่ถูกต้อง',
        `ตรวจ Subnet Mask ของ ${n.name}`,
        'Subnet Mask ต้องเป็นเลข 1 ต่อเนื่องกัน เช่น 255.255.255.0 (/24)',
      ]));
      continue;
    }
    const problem = ip.hostAddressProblem(n.ip, n.mask);
    if (problem) {
      const why = { network: 'เป็น Network Address', broadcast: 'เป็น Broadcast Address', loopback: 'เป็น Loopback', unspecified: 'เป็น 0.0.0.0', multicast: 'เป็น Multicast' }[problem];
      issues.push(issue('RESERVED_IP', 'error', [n.id], `IP ${n.ip} ของ ${n.name} ${why} ใช้กับเครื่องไม่ได้`, [
        'มี IP ที่สงวนไว้ ใช้กับเครื่องไม่ได้',
        `ตรวจ IP ของ ${n.name}`,
        'เลขชุดสุดท้ายไม่ควรเป็น 0 หรือ 255 (สำหรับ /24) ให้ใช้ 1–254',
      ]));
      continue;
    }
    if (c.gateway) {
      if (!ip.isValidIp(c.gateway)) {
        issues.push(issue('INVALID_GATEWAY', 'error', [n.id], `Default Gateway ของ ${n.name} ("${c.gateway}") ไม่ถูกต้อง`, [
          'มี Default Gateway ที่เขียนผิดรูปแบบ', `ตรวจ Gateway ของ ${n.name}`, 'Gateway ต้องเป็น IP ของ Router เช่น 192.168.1.1',
        ]));
      } else if (!ip.sameSubnet(c.ip, c.gateway, c.mask)) {
        issues.push(issue('GATEWAY_OTHER_SUBNET', 'error', [n.id], `Default Gateway ${c.gateway} ของ ${n.name} อยู่คนละวงเครือข่ายกับ IP ${c.ip}`, [
          'มีเครื่องที่ตั้ง Gateway คนละวงกับตัวเอง',
          `ตรวจ Gateway ของ ${n.name}`,
          'Gateway ต้องอยู่วงเดียวกับ IP ของเครื่อง และควรเป็น IP ของ Router',
        ]));
      } else if (!nodes.some((r) => r.type === 'router' && config.get(r.id)?.ip === c.gateway)) {
        issues.push(issue('GATEWAY_NOT_ROUTER', 'warning', [n.id], `ไม่พบ Router ที่ใช้ IP ${c.gateway} ซึ่ง ${n.name} ตั้งเป็น Default Gateway`, [
          'มีเครื่องที่ตั้ง Gateway ไม่ตรงกับ Router',
          `ตรวจ Gateway ของ ${n.name}`,
          'ตั้ง Gateway ให้ตรงกับ IP ของ Router',
        ]));
      }
    }
  }

  // Duplicate addresses (only among valid configs).
  const byIp = new Map();
  for (const n of nodes) {
    const c = config.get(n.id);
    if (!c.valid) continue;
    if (!byIp.has(c.ip)) byIp.set(c.ip, []);
    byIp.get(c.ip).push(n);
  }
  for (const [addr, list] of byIp) {
    if (list.length < 2) continue;
    issues.push(issue('DUPLICATE_IP', 'error', list.map((n) => n.id), `IP ${addr} ถูกใช้ซ้ำกันที่ ${list.map((n) => n.name).join(', ')}`, [
      'มี IP Address ที่ซ้ำกัน',
      `ตรวจ ${list.map((n) => n.name).join(' และ ')}`,
      'ทุกเครื่องในเครือข่ายต้องมี IP ไม่ซ้ำกัน เปลี่ยนเลขชุดสุดท้ายของเครื่องใดเครื่องหนึ่ง',
    ]));
  }

  // Hosts whose subnet does not match their segment's router.
  for (const n of nodes) {
    const c = config.get(n.id);
    if (!c.valid || n.type === 'router' || c.source === 'apipa') continue;
    const router = nodes.find((r) => r.type === 'router' && segmentOf.get(r.id) === segmentOf.get(n.id) && config.get(r.id).valid);
    if (!router) continue;
    const rc = config.get(router.id);
    if (!ip.sameSubnet(c.ip, rc.ip, c.mask) || !ip.sameSubnet(c.ip, rc.ip, rc.mask)) {
      issues.push(issue('SUBNET_MISMATCH', 'error', [n.id], `${ipLabel(n)} อยู่คนละวงเครือข่ายกับ ${ipLabel(router)}`, [
        'มีเครื่องที่ IP อยู่คนละวงกับ Router',
        `ตรวจ IP และ Subnet Mask ของ ${n.name}`,
        `ใช้ IP วงเดียวกับ Router เช่น ${ip.formatIp(ip.networkOf(rc.ip, rc.mask) + 50)} และ Mask ${rc.mask}`,
      ]));
    }
  }

  const severity = new Map();
  for (const i of issues) {
    for (const id of i.deviceIds) {
      if (i.severity === 'error' || !severity.has(id)) severity.set(id, i.severity);
    }
  }

  const devices = nodes.map((n) => {
    const c = config.get(n.id);
    return {
      id: n.id, name: n.name, type: n.type, ip: c.ip, mask: c.mask, gateway: c.gateway, dns: c.dns,
      source: c.source, mac: macOf(n.id), hostname: hostnameOf(n),
      connected: adjacency.get(n.id).length > 0,
      status: severity.get(n.id) === 'error' ? 'error' : severity.get(n.id) === 'warning' ? 'warning' : 'ok',
    };
  });

  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const errors = issues.filter((i) => i.severity === 'error').length;
  return {
    ok: errors === 0,
    devices,
    links: net.links,
    issues,
    stats: {
      devices: nodes.length,
      links: net.links.length,
      workingLinks: net.links.filter((l) => l.ok).length,
      wifiClients: net.links.filter((l) => l.ok && l.kind === 'wireless').length,
      hostsOnline: devices.filter((d) => HOST_TYPES.includes(d.type) && d.connected && config.get(d.id).valid).length,
      errors,
      warnings: issues.length - errors,
      segments: new Set(segmentOf.values()).size,
    },
  };
}

// ---------- Routing (used by ping / traceroute / nslookup) ----------

function shortestPath(net, from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of net.adjacency.get(cur)) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, cur);
      if (e.to === to) {
        const path = [to];
        let p = cur;
        while (p !== null) { path.unshift(p); p = prev.get(p); }
        return path;
      }
      queue.push(e.to);
    }
  }
  return null;
}

function hopKind(net, a, b) {
  return net.adjacency.get(a).find((e) => e.to === b)?.kind || 'cable';
}

// Can `fromId` deliver an IP packet to `dstIp` and get a reply?
function route(net, fromId, dstIp) {
  const src = net.config.get(fromId);
  const from = net.byId.get(fromId);
  if (!src || !src.valid) return { ok: false, code: 'SRC_NO_IP', from };
  if (dstIp === src.ip) return { ok: true, code: 'SELF', path: [fromId], from, to: from };

  const owners = net.nodes.filter((n) => net.config.get(n.id).valid && net.config.get(n.id).ip === dstIp);
  const seg = net.segmentOf.get(fromId);
  const reachable = owners.filter((n) => net.segmentOf.get(n.id) === seg);

  const canReply = (dst) => {
    const dc = net.config.get(dst.id);
    if (ip.sameSubnet(dc.ip, src.ip, dc.mask)) return true;
    const gw = net.nodes.find((r) => r.type === 'router' && net.config.get(r.id).ip === dc.gateway && net.segmentOf.get(r.id) === seg);
    return !!gw && ip.sameSubnet(net.config.get(gw.id).ip, src.ip, net.config.get(gw.id).mask);
  };

  if (ip.sameSubnet(src.ip, dstIp, src.mask)) {
    if (!reachable.length) return { ok: false, code: owners.length ? 'NO_LINK' : 'HOST_NOT_FOUND', from, to: owners[0] };
    if (reachable.length > 1) return { ok: false, code: 'IP_CONFLICT', from, to: reachable[0], conflict: reachable };
    const dst = reachable[0];
    if (!canReply(dst)) return { ok: false, code: 'REPLY_NO_ROUTE', from, to: dst };
    return { ok: true, code: 'DIRECT', path: shortestPath(net, fromId, dst.id), from, to: dst };
  }

  // Different subnet → must go through the Default Gateway.
  if (!src.gateway) return { ok: false, code: 'NO_GATEWAY', from, to: owners[0] };
  if (!ip.isValidIp(src.gateway) || !ip.sameSubnet(src.ip, src.gateway, src.mask)) return { ok: false, code: 'GATEWAY_INVALID', from, to: owners[0] };
  const gw = net.nodes.find((r) => r.type === 'router' && net.config.get(r.id).valid && net.config.get(r.id).ip === src.gateway && net.segmentOf.get(r.id) === seg);
  if (!gw) return { ok: false, code: 'GATEWAY_UNREACHABLE', from, to: owners[0] };
  const gc = net.config.get(gw.id);
  if (dstIp === gc.ip) return { ok: true, code: 'DIRECT', path: shortestPath(net, fromId, gw.id), from, to: gw };
  if (!ip.sameSubnet(gc.ip, dstIp, gc.mask)) return { ok: false, code: 'NO_ROUTE', from, to: owners[0], gateway: gw };
  if (!reachable.length) return { ok: false, code: owners.length ? 'NO_LINK' : 'HOST_NOT_FOUND', from, to: owners[0], gateway: gw };
  if (reachable.length > 1) return { ok: false, code: 'IP_CONFLICT', from, to: reachable[0], conflict: reachable };
  const dst = reachable[0];
  if (!canReply(dst)) return { ok: false, code: 'REPLY_NO_ROUTE', from, to: dst, gateway: gw };
  const p1 = shortestPath(net, fromId, gw.id), p2 = shortestPath(net, gw.id, dst.id);
  return { ok: true, code: 'ROUTED', path: p1.concat(p2.slice(1)), from, to: dst, gateway: gw };
}

function explain(r, target) {
  const f = r.from?.name || 'ต้นทาง', t = r.to?.name || target;
  switch (r.code) {
    case 'SELF': return { message: `${f} ทดสอบกับตัวเองสำเร็จ`, hint: '' };
    case 'DIRECT': return { message: `${f} ส่งข้อมูลถึง ${t} ได้โดยตรงในวงเครือข่ายเดียวกัน`, hint: '' };
    case 'ROUTED': return { message: `${f} ส่งข้อมูลผ่าน ${r.gateway.name} (Default Gateway) ไปถึง ${t}`, hint: '' };
    case 'SRC_NO_IP': return { message: `${f} ยังไม่มี IP Address ที่ใช้งานได้ จึงส่ง Packet ไม่ได้`, hint: `ตั้ง IP ของ ${f} ให้ถูกต้อง หรือเปลี่ยนเป็น DHCP` };
    case 'HOST_NOT_FOUND': return { message: `ไม่มีเครื่องใดใช้ IP ${target} ในเครือข่ายนี้`, hint: 'ตรวจว่าพิมพ์ IP ปลายทางถูกต้อง' };
    case 'NO_LINK': return { message: `${f} กับ ${t} ไม่มีเส้นทางเชื่อมถึงกัน (สายหรือ Wi-Fi ขาดตอน)`, hint: 'ใช้ปุ่ม "ทดสอบเครือข่าย" เพื่อหาสายหรือ Wi-Fi ที่ยังไม่ได้ต่อหรือตั้งค่าผิด' };
    case 'IP_CONFLICT': return { message: `มีหลายเครื่องใช้ IP ${target} ซ้ำกัน (${r.conflict.map((n) => n.name).join(', ')}) ข้อมูลจึงไปผิดเครื่อง`, hint: 'เปลี่ยน IP ของเครื่องที่ซ้ำให้ไม่ซ้ำกัน' };
    case 'REPLY_NO_ROUTE': return { message: `${t} ได้รับข้อมูลแต่ตอบกลับไม่ได้ เพราะ Subnet Mask หรือ Gateway ของ ${t} ไม่ถูกต้อง`, hint: `ตรวจ Subnet Mask และ Gateway ของ ${t}` };
    case 'NO_GATEWAY': return { message: `${target} อยู่คนละวงเครือข่ายกับ ${f} และ ${f} ยังไม่ได้ตั้ง Default Gateway`, hint: `ตั้ง Default Gateway ของ ${f} เป็น IP ของ Router` };
    case 'GATEWAY_INVALID': return { message: `Default Gateway ของ ${f} ไม่ถูกต้องหรืออยู่คนละวง`, hint: `ตั้ง Gateway ของ ${f} เป็น IP ของ Router ในวงเดียวกัน` };
    case 'GATEWAY_UNREACHABLE': return { message: `${f} ติดต่อ Default Gateway ไม่ได้ (ไม่มี Router ที่ใช้ IP นั้นเชื่อมอยู่)`, hint: 'ตรวจว่า Gateway ตรงกับ IP ของ Router และเครื่องต่อถึง Router' };
    case 'NO_ROUTE': return { message: `${r.gateway.name} ไม่รู้จักเส้นทางไปยังวงเครือข่ายของ ${target}`, hint: 'ปลายทางต้องอยู่ในวงเครือข่ายเดียวกับ Router' };
    default: return { message: 'ส่งข้อมูลไม่สำเร็จ', hint: '' };
  }
}

// Turns a host name (or IP) into an IP using the source's DNS server.
function resolve(net, fromId, target) {
  if (ip.isValidIp(target)) return { ok: true, ip: target };
  const src = net.config.get(fromId);
  const name = target.trim().toLowerCase().replace(new RegExp(`\\.${DOMAIN.replace('.', '\\.')}$`), '');
  if (!src?.valid || !src.dns) return { ok: false, code: 'NO_DNS' };
  const dnsServer = net.nodes.find((n) => ['router', 'server'].includes(n.type) && net.config.get(n.id).valid && net.config.get(n.id).ip === src.dns);
  if (!dnsServer || !route(net, fromId, src.dns).ok) return { ok: false, code: 'DNS_UNREACHABLE', dns: src.dns };
  const found = net.nodes.find((n) => hostnameOf(n) === name && net.config.get(n.id).valid);
  if (!found) return { ok: false, code: 'NXDOMAIN', dns: src.dns, dnsServer };
  return { ok: true, ip: net.config.get(found.id).ip, node: found, dns: src.dns, dnsServer };
}

function findDevice(net, ref) {
  if (!ref) return null;
  return net.byId.get(ref) || net.nodes.find((n) => n.name.toLowerCase() === String(ref).toLowerCase()) || null;
}

function hopTime(net, path, i) {
  let t = 0;
  for (let k = 1; k < path.length; k++) t += hopKind(net, path[k - 1], path[k]) === 'wireless' ? 3 : 1;
  return Math.max(1, t * 2 + (i % 2));
}

// ---------- ping / traceroute ----------

function ping(workspace, fromRef, target, count = 4, prebuilt) {
  const net = prebuilt || build(workspace);
  const from = findDevice(net, fromRef);
  count = Math.min(Math.max(parseInt(count, 10) || 4, 1), 10);
  if (!from) return { ok: false, code: 'UNKNOWN_SOURCE', lines: ['ไม่พบอุปกรณ์ต้นทาง'], path: [], message: 'ไม่พบอุปกรณ์ต้นทาง', hint: '' };

  // A device reference (id/name) in the packet tool skips DNS.
  let dstIp = target;
  const targetDevice = net.byId.get(target);
  if (targetDevice) {
    const tc = net.config.get(targetDevice.id);
    if (!tc.ip) {
      return { ok: false, code: 'DST_NO_IP', lines: [`${targetDevice.name} ไม่มี IP Address`], path: [], from: from.id, to: targetDevice.id,
        message: `${targetDevice.name} ยังไม่มี IP Address จึงรับ Packet ไม่ได้`, hint: `ตั้ง IP ให้ ${targetDevice.name} หรือเปลี่ยนเป็น DHCP` };
    }
    dstIp = tc.ip;
  } else {
    const res = resolve(net, from.id, String(target || ''));
    if (!res.ok) {
      return { ok: false, code: res.code, lines: [`Ping request could not find host ${target}. Please check the name and try again.`], path: [], from: from.id,
        message: res.code === 'NO_DNS' ? `${from.name} ยังไม่ได้ตั้ง DNS Server จึงแปลงชื่อ "${target}" เป็น IP ไม่ได้` : res.code === 'DNS_UNREACHABLE' ? `${from.name} ติดต่อ DNS Server (${res.dns}) ไม่ได้` : `DNS ไม่รู้จักชื่อ "${target}"`,
        hint: res.code === 'NXDOMAIN' ? 'ตรวจชื่อเครื่องปลายทาง (ใช้ - แทนช่องว่าง)' : 'ตั้ง DNS Server เป็น IP ของ Router หรือใช้ DHCP' };
    }
    dstIp = res.ip;
  }

  const r = route(net, from.id, dstIp);
  const { message, hint } = explain(r, dstIp);
  const lines = [`Pinging ${dstIp} with 32 bytes of data:`];
  let received = 0;
  for (let i = 0; i < count; i++) {
    if (r.ok) {
      received++;
      const t = r.code === 'SELF' ? '<1ms' : `=${hopTime(net, r.path, i)}ms`;
      lines.push(`Reply from ${dstIp}: bytes=32 time${t} TTL=${r.code === 'ROUTED' ? 63 : 64}`);
    } else if (r.code === 'SRC_NO_IP' || r.code === 'NO_GATEWAY' || r.code === 'GATEWAY_INVALID') {
      lines.push('PING: transmit failed. General failure.');
    } else if (r.code === 'NO_ROUTE') {
      lines.push(`Reply from ${net.config.get(r.gateway.id).ip}: Destination net unreachable.`);
    } else if (r.code === 'HOST_NOT_FOUND' || (r.code === 'NO_LINK' && !r.gateway)) {
      lines.push(`Reply from ${net.config.get(from.id).ip || '0.0.0.0'}: Destination host unreachable.`);
    } else {
      lines.push('Request timed out.');
    }
  }
  const lost = count - received;
  lines.push('', `Ping statistics for ${dstIp}:`, `    Packets: Sent = ${count}, Received = ${received}, Lost = ${lost} (${Math.round((lost / count) * 100)}% loss),`);
  if (r.ok) {
    const times = Array.from({ length: count }, (_, i) => (r.code === 'SELF' ? 0 : hopTime(net, r.path, i)));
    lines.push('Approximate round trip times in milli-seconds:', `    Minimum = ${Math.min(...times)}ms, Maximum = ${Math.max(...times)}ms, Average = ${Math.round(times.reduce((a, b) => a + b, 0) / count)}ms`);
  }
  return {
    ok: r.ok, code: r.code, lines, path: r.ok ? r.path : (r.to ? partialPath(net, from.id, r) : [from.id]),
    from: from.id, to: r.to?.id || null, targetIp: dstIp, message, hint,
  };
}

// For failed pings: how far the packet physically got (used for the red animation).
function partialPath(net, fromId, r) {
  if (r.code === 'SRC_NO_IP' || r.code === 'NO_GATEWAY' || r.code === 'GATEWAY_INVALID') return [fromId];
  const toward = r.gateway?.id || r.to?.id;
  const full = toward ? shortestPath(net, fromId, toward) : null;
  if (full) return r.gateway && r.to ? full.concat((shortestPath(net, r.gateway.id, r.to.id) || []).slice(1)) : full;
  // Not connected: walk as far as the segment allows toward nothing — just the source.
  return [fromId];
}

function traceroute(workspace, fromRef, target, prebuilt) {
  const net = prebuilt || build(workspace);
  const p = ping(workspace, fromRef, target, 1, net);
  if (['NO_DNS', 'DNS_UNREACHABLE', 'NXDOMAIN'].includes(p.code)) return { ...p, lines: [`Unable to resolve target system name ${target}.`], hops: [] };
  if (p.code === 'UNKNOWN_SOURCE' || (!p.targetIp && !p.ok)) return { ...p, hops: [] };
  const lines = [`Tracing route to ${p.targetIp} over a maximum of 30 hops`, ''];
  const hops = [];
  const r = route(net, p.from, p.targetIp);
  const ms = (k) => `${String(k * 2 + 1).padStart(3)} ms`;
  if (r.ok) {
    if (r.code === 'ROUTED') hops.push({ ip: net.config.get(r.gateway.id).ip, device: r.gateway.id });
    hops.push({ ip: p.targetIp, device: r.to.id });
    hops.forEach((h, i) => lines.push(`  ${i + 1}  ${ms(i + 1)}  ${ms(i + 1)}  ${ms(i + 1)}  ${h.ip}`));
  } else {
    if (r.gateway) {
      hops.push({ ip: net.config.get(r.gateway.id).ip, device: r.gateway.id });
      lines.push(`  1  ${ms(1)}  ${ms(1)}  ${ms(1)}  ${hops[0].ip}`);
    }
    for (let i = hops.length; i < hops.length + 3; i++) lines.push(`  ${i + 1}     *        *        *     Request timed out.`);
  }
  lines.push('', 'Trace complete.');
  const physical = (p.path || []).map((id) => net.byId.get(id).name);
  if (physical.length > 1) lines.push('', `เส้นทางทางกายภาพ: ${physical.join(' → ')}`);
  return { ok: r.ok, code: r.code, lines, hops, path: p.path, from: p.from, to: r.to?.id || null, targetIp: p.targetIp, message: p.message, hint: p.hint };
}

// ---------- Terminal commands ----------

const HELP = [
  'คำสั่งที่ใช้ได้:',
  '  ipconfig [/all]       ดูการตั้งค่า IP ของเครื่องนี้',
  '  ping <IP|ชื่อ> [-n N] ทดสอบการติดต่อกับเครื่องปลายทาง',
  '  tracert <IP|ชื่อ>     ดูเส้นทางที่ข้อมูลเดินทาง (traceroute ก็ได้)',
  '  arp -a                ดูตาราง IP ↔ MAC ของเครื่องในวงเดียวกัน',
  '  nslookup <ชื่อ>       ถาม DNS ว่าชื่อเครื่องนี้มี IP อะไร',
  '  hostname              ดูชื่อเครื่อง',
  '  clear / cls           ล้างหน้าจอ',
  '  help                  แสดงคำสั่งทั้งหมด',
];

function ipconfigLines(net, n, all) {
  const c = net.config.get(n.id);
  const wireless = net.links.some((l) => l.ok && l.kind === 'wireless' && (l.a === n.id || l.b === n.id));
  const lines = ['Windows IP Configuration', ''];
  if (all) lines.splice(1, 0, '', `   Host Name . . . . . . . . . . . . : ${hostnameOf(n)}`, `   Primary Dns Suffix  . . . . . . . : ${DOMAIN}`);
  lines.push(wireless ? 'Wireless LAN adapter Wi-Fi:' : 'Ethernet adapter Ethernet:', '');
  if (!net.adjacency.get(n.id).length) {
    lines.push('   Media State . . . . . . . . . . . : Media disconnected');
    if (all) lines.push(`   Physical Address. . . . . . . . . : ${macOf(n.id).toUpperCase()}`);
    return lines;
  }
  if (all) {
    lines.push(`   Physical Address. . . . . . . . . : ${macOf(n.id).toUpperCase()}`);
    lines.push(`   DHCP Enabled. . . . . . . . . . . : ${n.dhcp ? 'Yes' : 'No'}`);
  }
  const label = c.source === 'apipa' ? 'Autoconfiguration IPv4 Address. .' : 'IPv4 Address. . . . . . . . . . .';
  lines.push(`   ${label} : ${c.ip || '(ไม่ได้ตั้งค่า)'}`);
  lines.push(`   Subnet Mask . . . . . . . . . . . : ${c.ip ? c.mask : ''}`);
  lines.push(`   Default Gateway . . . . . . . . . : ${c.gateway}`);
  if (all) {
    if (c.source === 'dhcp') lines.push(`   DHCP Server . . . . . . . . . . . : ${net.config.get(c.server).ip}`);
    lines.push(`   DNS Servers . . . . . . . . . . . : ${c.dns}`);
  }
  return lines;
}

function arpLines(net, n) {
  const c = net.config.get(n.id);
  if (!c.valid) return ['No ARP Entries Found.'];
  const neighbours = net.nodes.filter((o) => o.id !== n.id && net.config.get(o.id).valid
    && net.segmentOf.get(o.id) === net.segmentOf.get(n.id) && ip.sameSubnet(c.ip, net.config.get(o.id).ip, c.mask));
  if (!neighbours.length) return ['No ARP Entries Found.'];
  const lines = [`Interface: ${c.ip} --- 0x3`, '  Internet Address      Physical Address      Type'];
  for (const o of neighbours) lines.push(`  ${net.config.get(o.id).ip.padEnd(22)}${macOf(o.id).padEnd(22)}dynamic`);
  return lines;
}

function nslookupLines(net, n, name) {
  const c = net.config.get(n.id);
  if (!name) return ['Usage: nslookup <ชื่อเครื่อง>'];
  if (!c.valid || !c.dns) return ['*** Default servers are not available', `*** UnKnown can't find ${name}: No response from server`];
  const res = resolve(net, n.id, name);
  if (res.code === 'DNS_UNREACHABLE') return ['DNS request timed out.', '    timeout was 2 seconds.', 'Server:  UnKnown', `Address:  ${c.dns}`, '', `*** Request to UnKnown timed-out`];
  const header = [`Server:  ${res.dnsServer ? hostnameOf(res.dnsServer) + '.' + DOMAIN : 'UnKnown'}`, `Address:  ${c.dns}`, ''];
  if (!res.ok) return [...header, `*** ${res.dnsServer ? hostnameOf(res.dnsServer) : 'UnKnown'}.${DOMAIN} can't find ${name}: Non-existent domain`];
  return [...header, `Name:    ${res.node ? hostnameOf(res.node) + '.' + DOMAIN : name}`, `Address:  ${res.ip}`];
}

function exec(workspace, deviceRef, commandLine) {
  const net = build(workspace);
  const n = findDevice(net, deviceRef);
  if (!n) return { ok: false, lines: ['ไม่พบอุปกรณ์ที่เลือก'] };
  const parts = String(commandLine || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { ok: true, lines: [] };
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  switch (cmd) {
    case 'help': case '?': return { ok: true, lines: HELP };
    case 'clear': case 'cls': return { ok: true, lines: [], clear: true };
    case 'hostname': return { ok: true, lines: [hostnameOf(n)] };
    case 'ipconfig': case 'ifconfig': return { ok: true, lines: ipconfigLines(net, n, args.some((a) => a.toLowerCase() === '/all' || a === '-a')) };
    case 'arp': return args[0] === '-a' ? { ok: true, lines: arpLines(net, n) } : { ok: false, lines: ['Usage: arp -a'] };
    case 'nslookup': return { ok: true, lines: nslookupLines(net, n, args[0]) };
    case 'ping': {
      const target = args.find((a) => !a.startsWith('-') && !/^\d+$/.test(a) || ip.isValidIp(a));
      const nIdx = args.findIndex((a) => a === '-n' || a === '-c');
      const count = nIdx >= 0 ? args[nIdx + 1] : 4;
      if (!target) return { ok: false, lines: ['Usage: ping <IP หรือชื่อเครื่อง> [-n จำนวนครั้ง]'] };
      const r = ping(workspace, n.id, target, count, net);
      return { ok: r.ok, lines: r.lines, path: r.path, message: r.message, hint: r.hint };
    }
    case 'tracert': case 'traceroute': {
      if (!args[0]) return { ok: false, lines: ['Usage: tracert <IP หรือชื่อเครื่อง>'] };
      const r = traceroute(workspace, n.id, args[0], net);
      return { ok: r.ok, lines: r.lines, path: r.path, message: r.message, hint: r.hint };
    }
    default:
      return { ok: false, lines: [`'${parts[0]}' is not recognized as an internal or external command,`, 'operable program or batch file.', 'พิมพ์ help เพื่อดูคำสั่งที่ใช้ได้'] };
  }
}

module.exports = {
  normalize, build, analyze, ping, traceroute, exec, resolve, route, macOf, hostnameOf,
  HOST_TYPES, DEVICE_TYPES, TYPE_LABEL, DEFAULT_WIFI_PASSWORD,
};
