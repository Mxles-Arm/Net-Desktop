'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ip = require('../src/engine/ip');
const engine = require('../src/engine/network');

// Small LAN: Router — Switch — PC1, PC2 ; Router ~ Notebook (Wi-Fi)
function lan(overrides = {}) {
  const nodes = [
    { id: 'r1', type: 'router', name: 'Router', ip: '192.168.1.1', wifi: true, ssid: 'CAI', password: 'secret123' },
    { id: 's1', type: 'switch', name: 'Switch' },
    { id: 'p1', type: 'pc', name: 'PC-01', ip: '192.168.1.11', gateway: '192.168.1.1' },
    { id: 'p2', type: 'pc', name: 'PC-02', ip: '192.168.1.12', gateway: '192.168.1.1' },
    { id: 'l1', type: 'laptop', name: 'Notebook-01', ip: '192.168.1.21', gateway: '192.168.1.1', wifi: true, ssid: 'CAI', password: 'secret123' },
  ].map((n) => ({ ...n, ...(overrides[n.id] || {}) }));
  const links = overrides.links || [
    { a: 'r1', b: 's1', kind: 'cable' },
    { a: 's1', b: 'p1', kind: 'cable' },
    { a: 's1', b: 'p2', kind: 'cable' },
    { a: 'r1', b: 'l1', kind: 'wireless' },
  ];
  return { nodes, links };
}
const codes = (a) => a.issues.map((i) => i.code);

test('ip helpers', () => {
  assert.equal(ip.isValidIp('192.168.1.1'), true);
  assert.equal(ip.isValidIp('192.168.1.256'), false);
  assert.equal(ip.isValidIp('192.168.1'), false);
  assert.equal(ip.isValidMask('255.255.255.0'), true);
  assert.equal(ip.isValidMask('255.0.255.0'), false);
  assert.equal(ip.maskToPrefix('255.255.255.128'), 25);
  assert.equal(ip.sameSubnet('192.168.1.5', '192.168.1.200', '255.255.255.0'), true);
  assert.equal(ip.sameSubnet('192.168.1.5', '192.168.2.5', '255.255.255.0'), false);
  assert.equal(ip.hostAddressProblem('192.168.1.0', '255.255.255.0'), 'network');
  assert.equal(ip.hostAddressProblem('192.168.1.255', '255.255.255.0'), 'broadcast');
  assert.equal(ip.hostAddressProblem('192.168.1.7', '255.255.255.0'), null);
});

test('a correct LAN has no errors and everyone can ping', () => {
  const ws = lan();
  const a = engine.analyze(ws);
  assert.deepEqual(codes(a), []);
  assert.equal(a.ok, true);
  assert.equal(engine.ping(ws, 'p1', '192.168.1.12').ok, true);
  assert.equal(engine.ping(ws, 'l1', '192.168.1.11').ok, true);
  const p = engine.ping(ws, 'p1', 'l1');
  assert.deepEqual(p.path, ['p1', 's1', 'r1', 'l1']);
});

test('old saved workspaces (no mask / password fields) still work', () => {
  const ws = {
    nodes: [
      { id: 'r1', type: 'router', name: 'Router หลัก', ip: '192.168.1.1', wifi: true, ssid: 'CAI-Classroom' },
      { id: 's1', type: 'switch', name: 'Switch ห้องเรียน', ip: '192.168.1.2' },
      { id: 'p1', type: 'pc', name: 'PC-01', ip: '192.168.1.11' },
      { id: 'l1', type: 'laptop', name: 'Notebook-01', ip: '192.168.1.21', wifi: true, ssid: 'CAI-Classroom' },
    ],
    links: [{ a: 'r1', b: 's1', kind: 'cable' }, { a: 's1', b: 'p1', kind: 'cable' }, { a: 'r1', b: 'l1', kind: 'wireless' }],
  };
  assert.equal(engine.analyze(ws).ok, true);
  assert.equal(engine.ping(ws, 'p1', 'l1').ok, true);
});

test('duplicate IP is detected and ping reports a conflict', () => {
  const ws = lan({ p2: { ip: '192.168.1.11' } });
  const a = engine.analyze(ws);
  assert.ok(codes(a).includes('DUPLICATE_IP'));
  assert.equal(engine.ping(ws, 'l1', '192.168.1.11').code, 'IP_CONFLICT');
});

test('invalid IP, mask, reserved address and gateway in another subnet', () => {
  assert.ok(codes(engine.analyze(lan({ p1: { ip: '192.168.1.300' } }))).includes('INVALID_IP'));
  assert.ok(codes(engine.analyze(lan({ p1: { mask: '255.0.255.0' } }))).includes('INVALID_MASK'));
  assert.ok(codes(engine.analyze(lan({ p1: { ip: '192.168.1.255' } }))).includes('RESERVED_IP'));
  assert.ok(codes(engine.analyze(lan({ p1: { gateway: '192.168.2.1' } }))).includes('GATEWAY_OTHER_SUBNET'));
  assert.ok(codes(engine.analyze(lan({ p1: { gateway: '192.168.1.99' } }))).includes('GATEWAY_NOT_ROUTER'));
});

test('host in a different subnet cannot reach the router', () => {
  const ws = lan({ p1: { ip: '192.168.2.11', gateway: '' } });
  assert.ok(codes(engine.analyze(ws)).includes('SUBNET_MISMATCH'));
  const p = engine.ping(ws, 'p1', '192.168.1.1');
  assert.equal(p.ok, false);
  assert.equal(p.code, 'NO_GATEWAY');
  assert.match(p.lines[1], /transmit failed/);
});

test('missing cable: isolated device and NO_LINK ping', () => {
  const ws = lan({ links: [{ a: 'r1', b: 's1', kind: 'cable' }, { a: 's1', b: 'p1', kind: 'cable' }, { a: 'r1', b: 'l1', kind: 'wireless' }] });
  const a = engine.analyze(ws);
  assert.ok(codes(a).includes('ISOLATED'));
  assert.equal(a.devices.find((d) => d.id === 'p2').status, 'error');
  const p = engine.ping(ws, 'p1', '192.168.1.12');
  assert.equal(p.code, 'NO_LINK');
  assert.match(p.lines[1], /Destination host unreachable/);
});

test('Wi-Fi problems: wrong password, wrong SSID, AP off, PC on Wi-Fi', () => {
  let ws = lan({ l1: { password: 'nope' } });
  assert.ok(codes(engine.analyze(ws)).includes('WIFI_WRONG_PASSWORD'));
  assert.equal(engine.ping(ws, 'l1', '192.168.1.1').ok, false);

  assert.ok(codes(engine.analyze(lan({ l1: { ssid: 'Other' } }))).includes('WIFI_SSID_MISMATCH'));
  assert.ok(codes(engine.analyze(lan({ r1: { wifi: false } }))).includes('WIFI_AP_OFF'));

  ws = lan();
  ws.links.push({ a: 'r1', b: 'p2', kind: 'wireless' });
  assert.ok(codes(engine.analyze(ws)).includes('WIFI_CLIENT_UNSUPPORTED'));
});

test('access point bridges Wi-Fi clients to the wired LAN', () => {
  const ws = lan({ l1: { ssid: 'LAB', password: 'labpass99' } });
  ws.nodes.push({ id: 'a1', type: 'access', name: 'AP', wifi: true, ssid: 'LAB', password: 'labpass99' });
  ws.links = ws.links.filter((l) => l.b !== 'l1').concat({ a: 'a1', b: 'l1', kind: 'wireless' });
  // Not wired yet → warning, and no route to the PCs.
  assert.ok(codes(engine.analyze(ws)).includes('AP_NOT_WIRED'));
  assert.equal(engine.ping(ws, 'l1', '192.168.1.11').ok, false);
  ws.links.push({ a: 's1', b: 'a1', kind: 'cable' });
  assert.equal(engine.analyze(ws).ok, true);
  assert.deepEqual(engine.ping(ws, 'l1', '192.168.1.11').path, ['l1', 'a1', 's1', 'p1']);
});

test('DHCP leases addresses from the router, APIPA without a server', () => {
  const ws = lan({ p1: { ip: '', gateway: '', dhcp: true }, p2: { ip: '', gateway: '', dhcp: true } });
  const a = engine.analyze(ws);
  assert.equal(a.ok, true);
  const d1 = a.devices.find((d) => d.id === 'p1');
  assert.equal(d1.source, 'dhcp');
  assert.equal(d1.ip, '192.168.1.100');
  assert.equal(d1.gateway, '192.168.1.1');
  assert.equal(a.devices.find((d) => d.id === 'p2').ip, '192.168.1.101');
  assert.equal(engine.ping(ws, 'p1', '192.168.1.1').ok, true);

  const off = lan({ r1: { dhcpServer: false }, p1: { ip: '', dhcp: true } });
  const b = engine.analyze(off);
  assert.ok(codes(b).includes('NO_DHCP_SERVER'));
  assert.match(b.devices.find((d) => d.id === 'p1').ip, /^169\.254\./);
});

test('DHCP skips addresses already used statically', () => {
  const ws = lan({ p1: { ip: '192.168.1.100' }, p2: { ip: '', dhcp: true } });
  assert.equal(engine.analyze(ws).devices.find((d) => d.id === 'p2').ip, '192.168.1.101');
});

test('routing through the gateway, and no route to other networks', () => {
  const ws = lan();
  // Ping an address outside the LAN: router has no route.
  const p = engine.ping(ws, 'p1', '10.0.0.5');
  assert.equal(p.code, 'NO_ROUTE');
  assert.match(p.lines[1], /Destination net unreachable/);
  // Host with /25 mask reaching .200 goes via the router.
  const ws2 = lan({ p1: { mask: '255.255.255.128' }, p2: { ip: '192.168.1.200' } });
  const r = engine.ping(ws2, 'p1', '192.168.1.200');
  assert.equal(r.ok, true);
  assert.equal(r.code, 'ROUTED');
});

test('terminal commands', () => {
  const ws = lan({ p1: { dns: '192.168.1.1' } });
  assert.match(engine.exec(ws, 'p1', 'ipconfig').lines.join('\n'), /IPv4 Address.*192\.168\.1\.11/);
  assert.match(engine.exec(ws, 'p1', 'ipconfig /all').lines.join('\n'), /Physical Address/);
  assert.equal(engine.exec(ws, 'p1', 'ping 192.168.1.12 -n 2').lines.filter((l) => l.startsWith('Reply')).length, 2);
  assert.equal(engine.exec(ws, 'p1', 'ping pc-02').ok, true);
  assert.equal(engine.exec(ws, 'p2', 'ping pc-01').ok, false); // PC-02 has no DNS server
  assert.match(engine.exec(ws, 'p1', 'nslookup notebook-01').lines.join('\n'), /192\.168\.1\.21/);
  assert.match(engine.exec(ws, 'p1', 'nslookup nothing').lines.join('\n'), /Non-existent domain/);
  assert.match(engine.exec(ws, 'p1', 'arp -a').lines.join('\n'), /192\.168\.1\.12/);
  assert.match(engine.exec(ws, 'p1', 'tracert 192.168.1.21').lines.join('\n'), /Trace complete/);
  assert.equal(engine.exec(ws, 'p1', 'clear').clear, true);
  assert.equal(engine.exec(ws, 'p1', 'rm -rf /').ok, false);
});

test('garbage input never throws', () => {
  for (const ws of [null, undefined, 42, 'x', {}, { nodes: 'x' }, { nodes: [null, 1, { id: 'a' }], links: [null, { a: 'zz', b: 'yy' }] }]) {
    assert.doesNotThrow(() => engine.analyze(ws));
    assert.doesNotThrow(() => engine.ping(ws, 'a', 'b'));
    assert.doesNotThrow(() => engine.exec(ws, 'a', 'ping 1.2.3.4'));
  }
});
