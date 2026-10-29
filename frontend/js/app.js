const icons = ["router", "switch", "pc", "laptop", "server", "access"];
let windows = [],
  active = null,
  zTop = 10,
  winSeq = 0,
  packetTransfer = null;
const layer = document.querySelector("#windowLayer"),
  desktop = document.querySelector("#desktop");
// Network fields (mask, gateway, dns, dhcp, password, dhcpServer) are read by the backend Network Engine.
// See docs/DATA-FORMAT.md.
const seed = [
  {
    id: "r1",
    type: "router",
    name: "Router หลัก",
    ip: "192.168.1.1",
    mask: "255.255.255.0",
    dhcpServer: true,
    x: 390,
    y: 55,
    w: 110,
    h: 88,
    wifi: true,
    ssid: "CAI-Classroom",
    password: "classroom123",
  },
  { id: "s1", type: "switch", name: "Switch ห้องเรียน", ip: "", x: 390, y: 180, w: 110, h: 88 },
  {
    id: "p1",
    type: "pc",
    name: "PC-01",
    ip: "192.168.1.11",
    mask: "255.255.255.0",
    gateway: "192.168.1.1",
    dns: "192.168.1.1",
    x: 120,
    y: 190,
    w: 110,
    h: 88,
  },
  {
    id: "l1",
    type: "laptop",
    name: "Notebook-01",
    ip: "192.168.1.21",
    mask: "255.255.255.0",
    gateway: "192.168.1.1",
    dns: "192.168.1.1",
    // Keep inside the default canvas (~530px wide in a 900px window).
    x: 180,
    y: 340,
    w: 110,
    h: 88,
    wifi: true,
    ssid: "CAI-Classroom",
    password: "classroom123",
  },
];
const HOST_TYPES = ["pc", "laptop", "server"];
function markDirty(w) {
  if (!w) return;
  w.dirty = true;
  window.CAI?.onChange(w);
}
function newWorkspace(saved) {
  const id = "ws" + ++winSeq,
    offset = (windows.length % 4) * 28,
    state = {
      id,
      name: saved?.name || `Classroom Workspace ${winSeq}`,
      nodes: structuredClone(saved?.nodes || seed),
      links: structuredClone(
        saved?.links || [
          { a: "r1", b: "s1", kind: "cable" },
          { a: "s1", b: "p1", kind: "cable" },
          { a: "r1", b: "l1", kind: "wireless" },
        ],
      ),
      notes: structuredClone(saved?.notes || []),
      strokes: structuredClone(saved?.strokes || []),
      selected: null,
      history: [],
      zoom: 1,
      wire: null,
      mode: "select",
      packetFrom: null,
      wifiFrom: null,
      serverId: saved?.serverId || null,
      missionId: saved?.missionId || null,
      attemptId: saved?.missionAttemptId || saved?.attemptId || null,
      dirty: false,
      analysis: null,
    };
  const el = document.createElement("section");
  el.className = "workspace";
  el.dataset.id = id;
  el.style.left = 70 + offset + "px";
  el.style.top = 35 + offset + "px";
  el.innerHTML = `<header class="titlebar"><div class="traffic"><button class="close"></button><button class="min"></button><button class="max"></button></div><div class="window-title">${esc(state.name)}</div><div class="window-state"><button class="test-window">ทดสอบเครือข่าย</button><button class="test-window mission-check" hidden>🎯 ตรวจภารกิจ</button></div></header><div class="window-body"><aside class="tool-sidebar"><div class="side-heading">อุปกรณ์</div><div class="device-grid"><button class="side-device" draggable="true" data-type="router"><span class="mini-product"></span>Router</button><button class="side-device" draggable="true" data-type="switch"><span class="mini-product"></span>Switch</button><button class="side-device" draggable="true" data-type="pc"><span class="mini-product"></span>Computer</button><button class="side-device" draggable="true" data-type="laptop"><span class="mini-product"></span>Notebook</button><button class="side-device" draggable="true" data-type="server"><span class="mini-product"></span>Server</button><button class="side-device" draggable="true" data-type="access"><span class="mini-product"></span>Access Point</button></div><div class="side-heading tool-heading">เครื่องมือ</div><div class="side-tools"><div class="tool-cluster"><span class="tool-cluster-title">จัดวางและเชื่อมต่อ</span><button class="side-tool active" data-tool="select"><span class="tool-glyph" aria-hidden="true">↖</span><span class="tool-label">เลือกและย้าย</span></button><button class="side-tool" data-tool="wire"><span class="tool-glyph" aria-hidden="true">⌁</span><span class="tool-label">เชื่อมสาย LAN</span></button><button class="side-tool" data-tool="wifi"><span class="tool-glyph" aria-hidden="true">◔</span><span class="tool-label">เชื่อม Wi-Fi</span></button><button class="side-tool" data-wifi-settings><span class="tool-glyph" aria-hidden="true">⚙</span><span class="tool-label">ตั้งค่า Wi-Fi</span></button></div><div class="tool-cluster compact-tools"><span class="tool-cluster-title">อธิบายแผนผัง</span><button class="side-tool" data-tool="note"><span class="tool-glyph" aria-hidden="true">▰</span><span class="tool-label">โน้ต</span></button><button class="side-tool" data-tool="marker"><span class="tool-glyph" aria-hidden="true">✎</span><span class="tool-label">มาร์คเกอร์</span></button></div><div class="tool-cluster packet-cluster"><span class="tool-cluster-title">ทดสอบการสื่อสาร</span><button class="side-tool packet-tool" data-tool="packet"><span class="tool-glyph" aria-hidden="true">✉</span><span class="tool-copy"><span class="tool-label">ส่งแพ็กเก็ต</span><small>ต้นทาง → ปลายทาง</small></span><span class="tool-badge">TEST</span></button></div><button class="side-tool undo-tool" data-tool="undo"><span class="tool-glyph" aria-hidden="true">↶</span><span class="tool-label">ย้อนกลับ</span></button></div></aside><main class="canvas"><div class="canvas-scene"><svg class="wires"></svg><svg class="marker-layer"></svg></div><div class="canvas-tip" data-step="พร้อมใช้งาน">ลากพอร์ตสีฟ้าไปยังอุปกรณ์ปลายทาง</div></main><aside class="inspector"><h2 class="panel-title">Network Overview</h2><div class="overview"><div class="stat"><strong data-count="devices">0</strong><span>อุปกรณ์</span></div><div class="stat"><strong data-count="links">0</strong><span>การเชื่อมต่อ</span></div></div><div class="net-status" data-net-status></div><div class="mission-panel" hidden></div><div class="rule"></div><h2 class="panel-title">Inspector</h2><div class="empty">เลือกอุปกรณ์เพื่อแก้ไขและปรับขนาด</div><div class="selected"><div class="preview-device"><div class="product"></div></div><div class="field"><label>ชื่ออุปกรณ์</label><input data-field="name"></div><div class="field" data-for="host"><label>การรับ IP</label><select data-field="dhcp"><option value="manual">กำหนดเอง (Manual)</option><option value="dhcp">อัตโนมัติ (DHCP)</option></select></div><div class="field"><label>IP Address</label><input data-field="ip" placeholder="เช่น 192.168.1.20"></div><div class="field"><label>Subnet Mask</label><input data-field="mask" placeholder="255.255.255.0"></div><div class="field" data-for="host"><label>Default Gateway</label><input data-field="gateway" placeholder="IP ของ Router"></div><div class="field" data-for="host"><label>DNS Server</label><input data-field="dns" placeholder="IP ของ Router"></div><div class="field" data-for="router"><label>DHCP Server (แจก IP อัตโนมัติ)</label><select data-field="dhcpServer"><option value="on">เปิด</option><option value="off">ปิด</option></select></div><div class="device-status" data-device-status></div><div class="size-row"><button class="small-btn" data-size="down">ย่อขนาด</button><button class="small-btn" data-size="up">ขยายขนาด</button></div><button class="delete">ลบอุปกรณ์</button></div></aside></div>`;
  [
    [".close", "ปิดหน้าต่าง"],
    [".min", "ย่อหน้าต่างลง Dock"],
    [".max", "ขยายหรือคืนขนาดหน้าต่าง"],
  ].forEach(([selector, label]) => {
    const button = el.querySelector(selector);
    button.setAttribute("aria-label", label);
    button.title = label;
  });
  const panelTitles = el.querySelectorAll(".panel-title");
  panelTitles[0].textContent = "ภาพรวมเครือข่าย";
  panelTitles[1].textContent = "ตัวตรวจสอบอุปกรณ์";
  el.querySelectorAll(".side-tool").forEach((button) => {
    if (button.querySelector(".tool-glyph")) return;
    const text = button.textContent.trim();
    const separator = text.indexOf(" ");
    if (separator < 0) return;
    const glyph = document.createElement("span");
    glyph.className = "tool-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = text.slice(0, separator);
    const label = document.createElement("span");
    label.className = "tool-label";
    label.textContent = text.slice(separator + 1);
    button.replaceChildren(glyph, label);
  });
  layer.appendChild(el);
  state.el = el;
  windows.push(state);
  bindWorkspace(state);
  focusWindow(state);
  render(state);
  syncMinimizedDock();
  return state;
}
function bindWorkspace(w) {
  const el = w.el,
    bar = el.querySelector(".titlebar");
  el.addEventListener("pointerdown", () => focusWindow(w));
  let moving = false,
    ox = 0,
    oy = 0;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    moving = true;
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!moving || el.classList.contains("maximized")) return;
    const lr = layer.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(lr.width - el.offsetWidth, e.clientX - lr.left - ox)) + "px";
    el.style.top = Math.max(0, Math.min(lr.height - el.offsetHeight, e.clientY - lr.top - oy)) + "px";
  });
  bar.addEventListener("pointerup", () => (moving = false));
  el.querySelector(".close").onclick = () => closeWorkspace(w);
  el.querySelector(".min").onclick = () => minimizeWorkspace(w);
  el.querySelector(".max").onclick = () => el.classList.toggle("maximized");
  el.querySelector(".test-window").onclick = () => testNetwork(w);
  el.querySelector(".mission-check").onclick = () => window.CAI?.checkMission(w);
  el.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => toolCommand(w, b.dataset.tool)));
  el.querySelectorAll(".side-device").forEach((b) => {
    b.ondragstart = (e) => e.dataTransfer.setData("text/device", b.dataset.type);
    b.onclick = () => addDevice(w, b.dataset.type, 250, 150);
  });
  const c = el.querySelector(".canvas");
  c.addEventListener("dragover", (e) => e.preventDefault());
  c.addEventListener("drop", (e) => {
    e.preventDefault();
    const t = e.dataTransfer.getData("text/device"),
      r = c.getBoundingClientRect();
    if (t) addDevice(w, t, e.clientX - r.left - 55, e.clientY - r.top - 44);
  });
  bindCanvasTools(w, c);
  el.querySelector("[data-field=name]").onchange = (e) => {
    const n = getSelected(w);
    if (n) {
      snapshot(w);
      n.name = e.target.value.trim() || n.name;
      render(w);
    }
  };
  // Network settings of the selected device.
  ["ip", "mask", "gateway", "dns"].forEach((f) => {
    el.querySelector(`[data-field=${f}]`).onchange = (e) => {
      const n = getSelected(w);
      if (!n) return;
      snapshot(w);
      n[f] = e.target.value.trim();
      render(w);
    };
  });
  el.querySelector("[data-field=dhcp]").onchange = (e) => {
    const n = getSelected(w);
    if (!n) return;
    snapshot(w);
    n.dhcp = e.target.value === "dhcp";
    render(w);
    toast(n.dhcp ? `${n.name} จะรับ IP อัตโนมัติจาก Router` : `${n.name} ใช้ IP ที่กำหนดเอง`);
  };
  el.querySelector("[data-field=dhcpServer]").onchange = (e) => {
    const n = getSelected(w);
    if (!n) return;
    snapshot(w);
    n.dhcpServer = e.target.value === "on";
    render(w);
  };
  el.querySelectorAll("[data-size]").forEach(
    (b) => (b.onclick = () => resizeSelected(w, b.dataset.size === "up" ? 1.18 : 0.84)),
  );
  el.querySelector(".delete").onclick = () => deleteSelected(w);
}
function focusWindow(w) {
  active = w;
  w.el.classList.remove("minimized");
  w.el.style.zIndex = ++zTop;
  syncMinimizedDock();
}
function minimizeWorkspace(w) {
  w.el.classList.add("minimized");
  if (active === w) active = windows.find((x) => !x.el.classList.contains("minimized") && x !== w) || null;
  syncMinimizedDock();
}
function closeWorkspace(w, force) {
  if (!force && w.dirty && window.CAI) return window.CAI.confirmClose(w);
  w.el.remove();
  windows = windows.filter((x) => x !== w);
  active = windows.find((x) => !x.el.classList.contains("minimized")) || null;
  if (active) focusWindow(active);
  syncMinimizedDock();
}
function syncMinimizedDock() {
  const area = document.querySelector("#minimizedArea");
  area.innerHTML = "";
  windows
    .filter((w) => w.el.classList.contains("minimized"))
    .forEach((w, i) => {
      const b = document.createElement("button");
      b.className = "minimized-app";
      b.title = w.name;
      b.textContent = String(i + 1);
      b.onclick = () => focusWindow(w);
      area.appendChild(b);
    });
  window.DesktopWindows?.renderMinimized(area);
}
window.syncMinimizedDock = syncMinimizedDock;
window.nextDesktopZ = () => ++zTop;
function snapshot(w) {
  w.history.push(JSON.stringify({ nodes: w.nodes, links: w.links, notes: w.notes, strokes: w.strokes }));
  if (w.history.length > 30) w.history.shift();
  markDirty(w);
}
function getSelected(w) {
  return w.nodes.find((n) => n.id === w.selected);
}
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
function render(w) {
  const scene = w.el.querySelector(".canvas-scene");
  scene.querySelectorAll(".node,.note").forEach((n) => n.remove());
  w.nodes.forEach((n) => {
    const d = document.createElement("div");
    const st = w.analysis?.devices.find((x) => x.id === n.id);
    d.className =
      "node" +
      (w.selected === n.id ? " active" : "") +
      (n.wifi ? " wifi-on" : "") +
      (st && st.status !== "ok" ? " st-" + st.status : "");
    d.dataset.id = n.id;
    d.dataset.type = n.type;
    Object.assign(d.style, { left: n.x + "px", top: n.y + "px", width: n.w + "px", height: n.h + "px" });
    const shownIp = n.dhcp ? (st?.ip ? st.ip : "DHCP") : n.ip;
    d.innerHTML = `<span class="product"></span><span class="node-name">${esc(n.name)}</span>${shownIp ? `<span class="node-ip">${esc(shownIp)}</span>` : ""}<span class="port"></span><span class="resize-device"></span>`;
    scene.appendChild(d);
    bindNode(w, d, n);
  });
  w.notes.forEach((note) => renderNote(w, scene, note));
  drawLinks(w);
  drawMarkers(w);
  updateInspector(w);
}
function center(n) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}
function drawLinks(w) {
  const svg = w.el.querySelector(".wires");
  let h = w.links
    .map((l, i) => {
      const a = w.nodes.find((n) => n.id === l.a),
        b = w.nodes.find((n) => n.id === l.b);
      if (!a || !b) return "";
      const p = center(a),
        q = center(b),
        m = (p.x + q.x) / 2;
      return `<path data-link-index="${i}" class="wire${l.kind === "wireless" ? " wireless" : ""}${w.selectedLink === i ? " selected" : ""}" d="M${p.x} ${p.y} C${m} ${p.y},${m} ${q.y},${q.x} ${q.y}"/>`;
    })
    .join("");
  if (w.wire) {
    const a = w.nodes.find((n) => n.id === w.wire.from),
      p = center(a),
      q = w.wire,
      m = (p.x + q.x) / 2;
    h += `<path class="wire-preview" d="M${p.x} ${p.y} C${m} ${p.y},${m} ${q.y},${q.x} ${q.y}"/>`;
  }
  svg.innerHTML = h;
}
function selectLink(w, i, e) {
  if (!w?.links[i]) return;
  focusWindow(w);
  w.selectedLink = i;
  w.selected = null;
  w.el.querySelectorAll(".node").forEach((x) => x.classList.remove("active"));
  drawLinks(w);
  updateInspector(w);
  const c = w.el.querySelector(".canvas"),
    cr = c.getBoundingClientRect(),
    link = w.links[i],
    a = w.nodes.find((n) => n.id === link.a),
    b = w.nodes.find((n) => n.id === link.b);
  let box = c.querySelector(".link-actions");
  if (!box) {
    box = document.createElement("div");
    box.className = "link-actions";
    box.innerHTML = '<strong></strong><button type="button">ลบการเชื่อมต่อ</button>';
    c.appendChild(box);
    box.querySelector("button").onclick = () => deleteSelectedLink(w);
  }
  box.querySelector("strong").textContent =
    `${link.kind === "wireless" ? "Wi-Fi" : "LAN"}: ${a?.name || "อุปกรณ์"} ↔ ${b?.name || "อุปกรณ์"}`;
  box.style.left = Math.max(100, Math.min(cr.width - 100, e.clientX - cr.left)) + "px";
  box.style.top = Math.max(65, Math.min(cr.height - 20, e.clientY - cr.top)) + "px";
  box.classList.add("show");
  toast("เลือกเส้นแล้ว — กดปุ่มลบหรือ Delete");
}
function deleteSelectedLink(w) {
  if (!w || !Number.isInteger(w.selectedLink) || !w.links[w.selectedLink]) return;
  snapshot(w);
  w.links.splice(w.selectedLink, 1);
  w.selectedLink = null;
  w.el.querySelector(".link-actions")?.classList.remove("show");
  drawLinks(w);
  updateInspector(w);
  toast("ลบการเชื่อมต่อแล้ว");
}
function clearLinkSelection(w) {
  if (!w) return;
  w.selectedLink = null;
  w.el.querySelector(".link-actions")?.classList.remove("show");
  drawLinks(w);
}
function bindNode(w, el, n) {
  let move = false,
    resize = false,
    dx = 0,
    dy = 0,
    sw = 0,
    sh = 0,
    sx = 0,
    sy = 0;
  el.addEventListener("pointerdown", (e) => {
    focusWindow(w);
    clearLinkSelection(w);
    if (w.mode === "packet" || packetTransfer) {
      e.stopPropagation();
      handlePacketClick(w, n);
      return;
    }
    if (w.mode === "wifi") {
      e.stopPropagation();
      handleWifiClick(w, n);
      return;
    }
    if (e.target.classList.contains("port") || e.target.classList.contains("resize-device")) return;
    snapshot(w);
    move = true;
    w.selected = n.id;
    const r = el.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
    updateInspector(w);
    w.el.querySelectorAll(".node").forEach((x) => x.classList.toggle("active", x === el));
  });
  el.addEventListener("pointermove", (e) => {
    if (!move) return;
    const c = w.el.querySelector(".canvas").getBoundingClientRect();
    n.x = Math.max(0, Math.min(c.width - n.w, e.clientX - c.left - dx));
    n.y = Math.max(0, Math.min(c.height - n.h, e.clientY - c.top - dy));
    el.style.left = n.x + "px";
    el.style.top = n.y + "px";
    drawLinks(w);
  });
  el.addEventListener("pointerup", () => (move = false));
  const rh = el.querySelector(".resize-device");
  rh.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    snapshot(w);
    resize = true;
    sw = n.w;
    sh = n.h;
    sx = e.clientX;
    sy = e.clientY;
    rh.setPointerCapture(e.pointerId);
  });
  rh.addEventListener("pointermove", (e) => {
    if (!resize) return;
    n.w = Math.max(75, Math.min(220, sw + e.clientX - sx));
    n.h = Math.max(60, Math.min(176, sh + e.clientY - sy));
    el.style.width = n.w + "px";
    el.style.height = n.h + "px";
    drawLinks(w);
  });
  rh.addEventListener("pointerup", () => {
    resize = false;
    updateInspector(w);
  });
  el.querySelector(".port").addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const c = w.el.querySelector(".canvas").getBoundingClientRect(),
      p = center(n);
    w.wire = { from: n.id, x: p.x, y: p.y };
    const mv = (ev) => {
        w.wire.x = ev.clientX - c.left;
        w.wire.y = ev.clientY - c.top;
        drawLinks(w);
      },
      up = (ev) => {
        window.removeEventListener("pointermove", mv);
        const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".node"),
          to = t?.dataset.id;
        if (
          to &&
          to !== n.id &&
          !w.links.some((l) => ((l.a === n.id && l.b === to) || (l.a === to && l.b === n.id)) && l.kind !== "wireless")
        ) {
          snapshot(w);
          w.links.push({ a: n.id, b: to, kind: "cable" });
          toast("เชื่อมต่อสายแล้ว");
        }
        w.wire = null;
        drawLinks(w);
        updateInspector(w);
      };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up, { once: true });
  });
}
function renderNote(w, scene, n) {
  const el = document.createElement("div");
  el.className = "note";
  el.style.left = n.x + "px";
  el.style.top = n.y + "px";
  el.innerHTML = `<textarea placeholder="พิมพ์โน้ต...">${esc(n.text)}</textarea>`;
  scene.appendChild(el);
  const ta = el.querySelector("textarea");
  ta.oninput = () => {
    n.text = ta.value;
    markDirty(w);
  };
  let drag = false,
    dx = 0,
    dy = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.target === ta) return;
    drag = true;
    const r = el.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const c = w.el.querySelector(".canvas").getBoundingClientRect();
    n.x = Math.max(0, Math.min(c.width - 130, e.clientX - c.left - dx));
    n.y = Math.max(0, Math.min(c.height - 105, e.clientY - c.top - dy));
    el.style.left = n.x + "px";
    el.style.top = n.y + "px";
  });
  el.addEventListener("pointerup", () => (drag = false));
}
function drawMarkers(w) {
  w.el.querySelector(".marker-layer").innerHTML = w.strokes
    .map((s) => `<polyline class="marker-stroke" points="${s.map((p) => p.join(",")).join(" ")}"/>`)
    .join("");
}
function bindCanvasTools(w, c) {
  let drawing = false,
    stroke = null;
  c.addEventListener("pointerdown", (e) => {
    if (w.mode === "note" && !e.target.closest(".node,.note")) {
      const r = c.getBoundingClientRect();
      snapshot(w);
      w.notes.push({ id: "note" + Date.now(), x: e.clientX - r.left - 65, y: e.clientY - r.top - 52, text: "" });
      render(w);
      toolCommand(w, "select");
      return;
    }
    if (w.mode === "marker" && !e.target.closest(".node,.note")) {
      snapshot(w);
      drawing = true;
      const r = c.getBoundingClientRect();
      stroke = [[e.clientX - r.left, e.clientY - r.top]];
      w.strokes.push(stroke);
      c.setPointerCapture(e.pointerId);
      drawMarkers(w);
    }
  });
  c.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const r = c.getBoundingClientRect();
    stroke.push([e.clientX - r.left, e.clientY - r.top]);
    drawMarkers(w);
  });
  c.addEventListener("pointerup", () => (drawing = false));
}
function handlePacketClick(w, n) {
  if (!packetTransfer) {
    packetTransfer = { w, n };
    w.packetFrom = n.id;
    w.el.querySelectorAll(".node").forEach((x) => x.classList.toggle("packet-source", x.dataset.id === n.id));
    windows.forEach((v) => {
      const tip = v.el.querySelector(".canvas-tip");
      v.el.classList.add("packet-targeting");
      tip.dataset.step = "2 จาก 2 · เลือกปลายทาง";
      tip.textContent = `ต้นทาง: ${n.name} (${w.name}) — คลิกอุปกรณ์ปลายทาง`;
    });
    toast("เลือกอุปกรณ์ปลายทางในหน้าต่างเดิมหรือ Workspace อื่น");
  } else {
    const source = packetTransfer;
    if (source.w === w && source.n.id === n.id) return toast("กรุณาเลือกอุปกรณ์ปลายทางคนละเครื่อง");
    packetTransfer = null;
    source.w.packetFrom = null;
    windows.forEach((v) => {
      v.el.classList.remove("packet-mode", "packet-targeting");
      v.el.querySelectorAll(".node").forEach((x) => x.classList.remove("packet-source"));
      const tip = v.el.querySelector(".canvas-tip");
      tip.dataset.step = "พร้อมใช้งาน";
      tip.textContent = "เลือกเครื่องมือส่งแพ็กเก็ตเพื่อทดสอบการสื่อสาร";
    });
    if (source.w === w) (window.CAI ? window.CAI.sendPacket(w, source.n, n) : animatePacket(w, source.n, n));
    else animateCrossPacket(source.w, source.n, w, n);
    toolCommand(source.w, "select");
  }
}
function animatePacket(w, a, b) {
  const scene = w.el.querySelector(".canvas-scene"),
    p = center(a),
    q = center(b),
    route = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    env = document.createElement("div");
  route.classList.add("packet-route");
  route.setAttribute("viewBox", `0 0 ${scene.clientWidth} ${scene.clientHeight}`);
  route.setAttribute("preserveAspectRatio", "none");
  route.innerHTML = `<polyline class="packet-route-glow" points="${p.x},${p.y} ${q.x},${q.y}"></polyline><polyline class="packet-route-flow" points="${p.x},${p.y} ${q.x},${q.y}"></polyline>`;
  scene.appendChild(route);
  env.className = "packet packet-hop packet-moving";
  env.innerHTML = '<span class="packet-symbol">✉</span><span class="packet-label">กำลังส่ง</span>';
  env.style.left = p.x + "px";
  env.style.top = p.y + "px";
  scene.appendChild(env);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      env.style.left = q.x + "px";
      env.style.top = q.y + "px";
    }),
  );
  setTimeout(() => {
    env.classList.remove("packet-moving");
    env.classList.add("packet-success");
    env.querySelector(".packet-symbol").textContent = "✓";
    env.querySelector(".packet-label").textContent = "ถึงปลายทางแล้ว";
    const bEl = w.el.querySelector(`.node[data-id="${b.id}"]`);
    if (bEl) {
      bEl.classList.add("pulse-node");
      setTimeout(() => bEl.classList.remove("pulse-node"), 1100);
    }
    toast(`ส่ง Packet จาก ${a.name} ไป ${b.name} สำเร็จ`);
    setTimeout(() => {
      env.remove();
      route.classList.add("packet-route-out");
      setTimeout(() => route.remove(), 220);
    }, 650);
  }, 1050);
}
function animateCrossPacket(fromW, a, toW, b) {
  const aEl = fromW.el.querySelector(`.node[data-id="${a.id}"]`),
    bEl = toW.el.querySelector(`.node[data-id="${b.id}"]`);
  if (!aEl || !bEl) return toast("ไม่พบอุปกรณ์ต้นทางหรือปลายทาง");
  const dr = desktop.getBoundingClientRect(),
    ar = aEl.getBoundingClientRect(),
    br = bEl.getBoundingClientRect(),
    env = document.createElement("div"),
    route = document.createElement("div"),
    startX = ar.left - dr.left + ar.width / 2,
    startY = ar.top - dr.top + ar.height / 2,
    endX = br.left - dr.left + br.width / 2,
    endY = br.top - dr.top + br.height / 2,
    distance = Math.hypot(endX - startX, endY - startY),
    angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
  route.className = "cross-packet-route";
  route.style.left = startX + "px";
  route.style.top = startY + "px";
  route.style.width = distance + "px";
  route.style.transform = `rotate(${angle}deg)`;
  desktop.appendChild(route);
  env.className = "cross-packet";
  env.textContent = "✉";
  env.style.left = startX - 12 + "px";
  env.style.top = startY - 12 + "px";
  desktop.appendChild(env);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      env.style.left = endX - 12 + "px";
      env.style.top = endY - 12 + "px";
      env.style.transform = "rotate(8deg) scale(1.15)";
    }),
  );
  setTimeout(() => {
    env.remove();
    route.remove();
    focusWindow(toW);
    bEl.classList.add("pulse-node");
    setTimeout(() => bEl.classList.remove("pulse-node"), 1100);
    // Each workspace is its own network with no cable between them, so the packet cannot arrive.
    showDialog(
      "ส่ง Packet ไม่สำเร็จ",
      `<p><b>${esc(a.name)}</b> [${esc(fromW.name)}] → <b>${esc(b.name)}</b> [${esc(toW.name)}]</p><p>แต่ละ Workspace คือเครือข่ายแยกกัน ไม่มีสายหรือ Wi-Fi เชื่อมถึงกัน Packet จึงไปไม่ถึงปลายทาง</p><p class="hint-line">💡 ลองส่ง Packet ระหว่างเครื่องใน Workspace เดียวกัน</p>`,
    );
  }, 1550);
}
function handleWifiClick(w, n) {
  if (!w.wifiFrom) {
    w.wifiFrom = n.id;
    n.wifi = true;
    render(w);
    toast("เลือกอุปกรณ์ปลายทางสำหรับ Wi-Fi");
  } else if (w.wifiFrom !== n.id) {
    const from = w.nodes.find((x) => x.id === w.wifiFrom);
    if (
      !w.links.some(
        (l) => ((l.a === from.id && l.b === n.id) || (l.a === n.id && l.b === from.id)) && l.kind === "wireless",
      )
    ) {
      snapshot(w);
      from.wifi = true;
      n.wifi = true;
      // The client joins the network broadcast by the Router / Access Point side.
      const isAp = (x) => x.type === "router" || x.type === "access";
      const ap = isAp(n) && !isAp(from) ? n : from,
        client = ap === from ? n : from;
      ap.ssid = ap.ssid || "CAI-Classroom";
      if (ap.password === undefined) ap.password = "classroom123";
      client.ssid = ap.ssid;
      client.password = ap.password;
      w.links.push({ a: from.id, b: n.id, kind: "wireless" });
      toast(`เชื่อมต่อ ${from.name} กับ ${n.name} ผ่าน Wi-Fi แล้ว`);
    }
    w.wifiFrom = null;
    toolCommand(w, "select");
    render(w);
  }
}
function showWifiPanel(w) {
  if (!w) return toast("เปิด Workspace ก่อน");
  const selected = getSelected(w),
    devices = w.nodes.filter((n) => ["router", "laptop", "access"].includes(n.type)),
    current = selected && devices.includes(selected) ? selected : devices[0];
  if (!current) return showDialog("Wi-Fi", "เพิ่ม Router, Access Point หรือ Notebook ก่อน");
  showDialog(
    "Wi-Fi Settings",
    `<div class="wifi-panel"><label>อุปกรณ์</label><select id="wifiDevice">${devices.map((d) => `<option value="${esc(d.id)}" ${d === current ? "selected" : ""}>${esc(d.name)}${d.type === "laptop" ? " (เครื่องลูกข่าย)" : " (ตัวกระจายสัญญาณ)"}</option>`).join("")}</select><label>สถานะ</label><select id="wifiEnabled"><option value="on" ${current.wifi ? "selected" : ""}>เปิด Wi-Fi</option><option value="off" ${!current.wifi ? "selected" : ""}>ปิด Wi-Fi</option></select><label>${current.type === "laptop" ? "เชื่อมต่อกับ Wi-Fi ชื่อ (SSID)" : "ชื่อเครือข่ายที่กระจาย (SSID)"}</label><input id="wifiSsid" list="wifiSsidList" value="${esc(current.ssid || "CAI-Classroom")}"><datalist id="wifiSsidList">${[...new Set(w.nodes.filter((d) => d.type !== "laptop" && d.ssid).map((d) => d.ssid))].map((s) => `<option value="${esc(s)}">`).join("")}</datalist><label>รหัสผ่าน Wi-Fi</label><input id="wifiPassword" type="password" value="${esc(current.password ?? "classroom123")}"><div class="wifi-row"><button id="saveWifi">บันทึกการตั้งค่า</button><button id="startWifiLink">เชื่อมต่ออุปกรณ์</button></div></div>`,
  );
  setTimeout(() => {
    document.querySelector("#wifiDevice")?.addEventListener("change", (e) => {
      w.selected = e.target.value;
      render(w);
      showWifiPanel(w);
    });
    document.querySelector("#saveWifi").onclick = () => {
      snapshot(w);
      current.wifi = document.querySelector("#wifiEnabled").value === "on";
      current.ssid = document.querySelector("#wifiSsid").value.trim() || "CAI-Classroom";
      current.password = document.querySelector("#wifiPassword").value;
      render(w);
      document.querySelector("#dialog").close();
      toast("บันทึกการตั้งค่า Wi-Fi แล้ว");
    };
    document.querySelector("#startWifiLink").onclick = () => {
      document.querySelector("#dialog").close();
      toolCommand(w, "wifi");
    };
  }, 0);
}
function showAboutNet() {
  showDialog(
    "About Net Desktop",
    `<div class="about-card"><div class="about-n">N</div><div class="about-title">Net Desktop</div><div class="about-meta">Version 1.6 — Wireless Edition<br>Workspace Memory: ${windows.length} Window(s)<br>Network Engine: Classroom Simulator</div><p>© 2026 CAI Net Learning Lab</p></div>`,
  );
}
// First 192.168.1.x address not used in this workspace (Routers prefer .1).
function freeIp(w, type) {
  const used = new Set(w.nodes.map((n) => n.ip));
  const start = type === "router" ? 1 : 10 + w.nodes.length;
  for (let k = 0; k < 254; k++) {
    const ip = `192.168.1.${((start - 1 + k) % 254) + 1}`;
    if (!used.has(ip)) return ip;
  }
  return "";
}
function addDevice(w, type, x, y) {
  if (!w) return toast("เปิด Workspace ก่อน");
  snapshot(w);
  const c = w.el.querySelector(".canvas"),
    wifi = ["router", "laptop", "access"].includes(type),
    layer2 = type === "switch" || type === "access",
    n = {
      id: "n" + Date.now() + Math.random(),
      type,
      name: {
        router: "Router",
        switch: "Switch",
        pc: "Computer",
        laptop: "Notebook",
        server: "Server",
        access: "Access Point",
      }[type],
      // Switches and Access Points work at Layer 2 and need no IP.
      ip: layer2 ? "" : freeIp(w, type),
      mask: "255.255.255.0",
      gateway: "",
      dns: "",
      x: Math.max(0, Math.min(c.clientWidth - 110, x)),
      y: Math.max(0, Math.min(c.clientHeight - 88, y)),
      w: 110,
      h: 88,
      wifi,
      ssid: wifi ? "CAI-Classroom" : "",
    };
  if (wifi) n.password = "classroom123";
  if (type === "router") n.dhcpServer = true;
  w.nodes.push(n);
  w.selected = n.id;
  render(w);
  toast("เพิ่มอุปกรณ์แล้ว");
}
function resizeSelected(w, k) {
  const n = getSelected(w);
  if (!n) return;
  snapshot(w);
  n.w = Math.max(75, Math.min(220, n.w * k));
  n.h = Math.max(60, Math.min(176, n.h * k));
  render(w);
}
function deleteSelected(w) {
  if (!w?.selected) return;
  snapshot(w);
  w.nodes = w.nodes.filter((n) => n.id !== w.selected);
  w.links = w.links.filter((l) => l.a !== w.selected && l.b !== w.selected);
  w.selected = null;
  render(w);
}
function updateInspector(w) {
  w.el.querySelector("[data-count=devices]").textContent = w.nodes.length;
  w.el.querySelector("[data-count=links]").textContent = w.links.length;
  window.CAI?.scheduleAnalysis(w);
  const n = getSelected(w),
    empty = w.el.querySelector(".empty"),
    box = w.el.querySelector(".selected");
  if (!n) {
    empty.style.display = "block";
    box.classList.remove("show");
    return;
  }
  empty.style.display = "none";
  box.classList.add("show");
  const preview = box.querySelector(".preview-device");
  preview.dataset.type = n.type;
  box.querySelector(".product").style.backgroundPosition = "center";
  box.querySelector("[data-field=name]").value = n.name;
  const st = w.analysis?.devices.find((x) => x.id === n.id),
    isHost = HOST_TYPES.includes(n.type),
    ipInput = box.querySelector("[data-field=ip]");
  box.querySelectorAll("[data-for=host]").forEach((f) => (f.hidden = !isHost));
  box.querySelectorAll("[data-for=router]").forEach((f) => (f.hidden = n.type !== "router"));
  box.querySelector("[data-field=dhcp]").value = n.dhcp ? "dhcp" : "manual";
  box.querySelector("[data-field=dhcpServer]").value = n.dhcpServer === false ? "off" : "on";
  // DHCP clients show the leased address read-only.
  ipInput.disabled = !!n.dhcp;
  ipInput.value = n.dhcp ? st?.ip || "" : n.ip || "";
  ipInput.placeholder = n.dhcp ? "รอรับจาก DHCP…" : n.type === "switch" || n.type === "access" ? "ไม่จำเป็น (Layer 2)" : "เช่น 192.168.1.20";
  ["mask", "gateway", "dns"].forEach((f) => {
    const input = box.querySelector(`[data-field=${f}]`);
    input.disabled = !!n.dhcp;
    input.value = n.dhcp ? st?.[f] || "" : n[f] || (f === "mask" && n.ip ? "255.255.255.0" : "");
  });
  window.CAI?.renderDeviceStatus(w, n);
}
function toolCommand(w, cmd) {
  if (!w) return;
  if (cmd === "undo") {
    const p = w.history.pop();
    if (p) {
      const s = JSON.parse(p);
      w.nodes = s.nodes;
      w.links = s.links;
      w.notes = s.notes || [];
      w.strokes = s.strokes || [];
      w.selected = null;
      render(w);
    }
  } else {
    w.mode = cmd;
    w.packetFrom = null;
    w.wifiFrom = null;
    w.el.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === cmd));
    w.el.classList.toggle("packet-mode", cmd === "packet");
    w.el.classList.remove("packet-targeting");
    const tips = {
      wire: "ลากจากพอร์ตสีฟ้าเพื่อเชื่อมสาย",
      wifi: "คลิกอุปกรณ์ต้นทาง แล้วคลิกปลายทางเพื่อเชื่อม Wi-Fi",
      note: "คลิกพื้นที่เพื่อวางโน้ต",
      marker: "ลากบนพื้นที่เพื่อวาดมาร์คเกอร์",
      packet: "คลิกอุปกรณ์ต้นทางเพื่อเริ่มส่งแพ็กเก็ต",
      select: "โหมดเลือกและย้าย",
    };
    const tip = w.el.querySelector(".canvas-tip");
    tip.dataset.step = cmd === "packet" ? "1 จาก 2 · เลือกต้นทาง" : "เครื่องมือที่เลือก";
    tip.textContent = tips[cmd] || tips.select;
    toast(tips[cmd] || tips.select);
  }
}
function testNetwork(w) {
  if (!w) return;
  if (window.CAI) return window.CAI.testNetwork(w);
  const isolated = w.nodes.filter((n) => !w.links.some((l) => l.a === n.id || l.b === n.id)),
    wireless = w.links.filter((l) => l.kind === "wireless").length;
  isolated.forEach((n) => {
    const el = w.el.querySelector(`.node[data-id="${n.id}"]`);
    if (el) el.classList.add("pulse-node");
  });
  toast(
    isolated.length
      ? `พบ ${isolated.length} อุปกรณ์ที่ยังไม่ได้เชื่อมต่อ`
      : `ทดสอบผ่าน: ${w.nodes.length} อุปกรณ์ · Wi-Fi ${wireless} จุดเชื่อมต่อ`,
  );
}
document.querySelector("[data-open=workspace]").onclick = () => newWorkspace();
document.querySelector("[data-action=help]").onclick = () =>
  showDialog(
    "วิธีใช้งาน",
    "เลือกอุปกรณ์จาก Sidebar ภายใน Workspace<br>ใช้เส้นทึบสำหรับสาย LAN และเส้นประสำหรับ Wi-Fi<br>คลิกเส้นเชื่อมต่อเพื่อเลือกและลบเป็นรายเส้น<br>ใช้โน้ต มาร์คเกอร์ และ Send Packet เพื่ออธิบายการสื่อสาร",
  );
document.querySelector("#wifiStatus").onclick = () => showWifiPanel(active);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-wifi-settings]");
  if (b) {
    const el = b.closest(".workspace"),
      w = windows.find((x) => x.el === el);
    showWifiPanel(w);
  }
  const path = e.target.closest("path.wire[data-link-index]");
  if (path) {
    e.stopPropagation();
    const el = path.closest(".workspace"),
      w = windows.find((x) => x.el === el);
    selectLink(w, Number(path.dataset.linkIndex), e);
  }
});
document.querySelectorAll("[data-menu]").forEach(
  (b) =>
    (b.onclick = (e) => {
      e.stopPropagation();
      const m = document.querySelector("#menu-" + b.dataset.menu),
        r = b.getBoundingClientRect(),
        was = m.classList.contains("open");
      closeMenus();
      if (!was) {
        m.style.left = r.left + "px";
        m.classList.add("open");
        b.classList.add("open");
      }
    }),
);
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".dropdown") && !e.target.closest("[data-menu]")) closeMenus();
});
function closeMenus() {
  document.querySelectorAll(".dropdown,[data-menu]").forEach((x) => x.classList.remove("open"));
}
document.querySelectorAll(".dropdown button").forEach(
  (b) =>
    (b.onclick = () => {
      command(b.dataset.cmd);
      closeMenus();
    }),
);
function command(cmd) {
  if (cmd === "new") newWorkspace();
  if (cmd === "save" && active) window.CAI?.save(active);
  if (cmd === "export" && active) {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              name: active.name,
              nodes: active.nodes,
              links: active.links,
              notes: active.notes,
              strokes: active.strokes,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "net-desktop-workspace.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  if (cmd === "close" && active) closeWorkspace(active);
  if (cmd === "details" && active) editDetails(active);
  if (cmd === "undo") toolCommand(active, "undo");
  if (cmd === "clear" && active) {
    snapshot(active);
    active.nodes = [];
    active.links = [];
    active.notes = [];
    active.strokes = [];
    active.selected = null;
    render(active);
  }
  if (cmd === "tile") tileWindows();
  if (cmd === "zoomIn" && active) setZoom(active, 0.1);
  if (cmd === "zoomOut" && active) setZoom(active, -0.1);
  if (cmd === "resetView" && active) {
    active.zoom = 1;
    active.el.querySelector(".canvas-scene").style.transform = "scale(1)";
  }
  if (cmd === "fullscreen" && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  if (cmd === "addRouter") addDevice(active, "router", 320, 140);
  if (cmd === "addSwitch") addDevice(active, "switch", 320, 180);
  if (cmd === "addPc") addDevice(active, "pc", 320, 220);
  if (cmd === "addLaptop") addDevice(active, "laptop", 320, 220);
  if (cmd === "addAccess") addDevice(active, "access", 320, 160);
  if (cmd === "wire") toolCommand(active, "wire");
  if (cmd === "wifi") toolCommand(active, "wifi");
  if (cmd === "wifiSettings") showWifiPanel(active);
  if (cmd === "test") testNetwork(active);
  if (cmd === "guide")
    showDialog(
      "Net Desktop Help",
      "เลือกอุปกรณ์จาก Sidebar ของ Workspace<br>ใช้ Connect Cable สำหรับสาย LAN หรือ Connect Wi-Fi สำหรับไร้สาย<br>เลือก Send Packet แล้วคลิกต้นทางและปลายทาง",
    );
  if (cmd === "encyclopedia") window.NetKnowledge?.open();
  if (cmd === "shortcuts")
    showDialog(
      "Keyboard Shortcuts",
      "⌘/Ctrl + N — Workspace ใหม่<br>⌘/Ctrl + S — บันทึก<br>⌘/Ctrl + Z — ย้อนกลับ<br>⌘/Ctrl + W — ปิด Workspace",
    );
  if (cmd === "aboutNet") showAboutNet();
  if (cmd === "systemInfo")
    showDialog(
      "System Information",
      `Net Desktop 1.6<br>Workspace ที่เปิด: ${windows.length}<br>อุปกรณ์ทั้งหมด: ${windows.reduce((n, w) => n + w.nodes.length, 0)}<br>รองรับ LAN, Wi-Fi, Packet และหลายหน้าต่าง`,
    );
  if (cmd === "preferences") showWifiPanel(active);
  window.CAI?.command(cmd);
}
function setZoom(w, d) {
  w.zoom = Math.max(0.7, Math.min(1.5, w.zoom + d));
  w.el.querySelector(".canvas-scene").style.transform = `scale(${w.zoom})`;
  toast(`มุมมอง ${Math.round(w.zoom * 100)}%`);
}
function tileWindows() {
  const vis = windows.filter((w) => !w.el.classList.contains("minimized")),
    cols = Math.ceil(Math.sqrt(vis.length)),
    rows = Math.ceil(vis.length / cols),
    W = layer.clientWidth / cols,
    H = layer.clientHeight / rows;
  vis.forEach((w, i) => {
    w.el.classList.remove("maximized");
    w.el.style.left = (i % cols) * W + 4 + "px";
    w.el.style.top = Math.floor(i / cols) * H + 4 + "px";
    w.el.style.width = W - 8 + "px";
    w.el.style.height = H - 8 + "px";
  });
}
function editDetails(w) {
  showDialog(
    "Workspace Details",
    `<label>ชื่อ Workspace</label><input id="dialogName" value="${esc(w.name)}" style="width:100%;height:34px;margin-top:6px"><div class="dialog-actions"><button id="saveDetails">บันทึก</button></div>`,
  );
  setTimeout(
    () =>
      (document.querySelector("#saveDetails").onclick = () => {
        w.name = document.querySelector("#dialogName").value.trim() || w.name;
        w.el.querySelector(".window-title").textContent = w.name;
        markDirty(w);
        document.querySelector("#dialog").close();
      }),
    0,
  );
}
document.querySelector("[data-dock=workspace]").onclick = () => {
  const hidden = windows.find((w) => w.el.classList.contains("minimized"));
  hidden ? focusWindow(hidden) : newWorkspace();
};
document.querySelector("[data-dock=encyclopedia]").onclick = () => window.NetKnowledge?.open();
document.querySelector("[data-dock=lessons]").onclick = () => window.CAI?.missionControl();
document.querySelector("[data-dock=files]").onclick = () => window.CAI?.openFinder();
document.querySelector("[data-dock=settings]").onclick = () =>
  active ? editDetails(active) : toast("เปิด Workspace ก่อน");
document.querySelector("[data-dock=trash]").onclick = () => {
  if (!active) return toast("เปิด Workspace ก่อน");
  showDialog(
    "ล้าง Workspace",
    `ต้องการลบอุปกรณ์ สาย โน้ต และมาร์คเกอร์ทั้งหมดใน "${esc(active.name)}" ใช่ไหม?<br><small>กด ⌘/Ctrl + Z เพื่อย้อนกลับได้</small><div class="dialog-actions"><button id="confirmTrash" class="danger-btn">ล้างทั้งหมด</button></div>`,
  );
  document.querySelector("#confirmTrash").onclick = () => {
    document.querySelector("#dialog").close();
    command("clear");
    toast("ล้าง Workspace แล้ว");
  };
};
document.querySelector("#assistantDock").onclick = () => window.CAI?.assistant(active);
// opts.wide: wider window; opts.noClose: caller supplies its own buttons.
function showDialog(title, html, opts = {}) {
  const d = document.querySelector("#dialog");
  if (d.open) d.close();
  d.className = "dialog" + (opts.wide ? " wide" : "") + (opts.app ? ` ${opts.app}` : "");
  document.querySelector("#dialogTitle").textContent = title;
  document.querySelector("#dialogBody").innerHTML =
    html +
    (opts.noClose
      ? ""
      : '<div class="dialog-actions"><button onclick="document.querySelector(\'#dialog\').close()">ปิด</button></div>');
  d.showModal();
}
function toast(s) {
  const t = document.querySelector("#toast");
  t.textContent = s;
  // The toast is a popover so it is drawn above modal dialogs (which live in the top layer).
  // Re-opening it moves it to the top of the stack, above a dialog opened after it.
  if (t.showPopover) {
    if (t.matches(":popover-open")) t.hidePopover();
    t.showPopover();
  }
  t.classList.add("show");
  clearTimeout(t.timer);
  t.timer = setTimeout(() => {
    t.classList.remove("show");
    t.timer = setTimeout(() => t.matches?.(":popover-open") && t.hidePopover(), 250);
  }, 1800);
}
function updateClock() {
  document.querySelector("#clock").textContent = new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}
updateClock();
setInterval(updateClock, 30000);
document.addEventListener("keydown", (e) => {
  // While a dialog is open, keys belong to the dialog (e.g. Backspace must not delete a cable behind it).
  if (document.querySelector("#dialog").open) return;
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.target.matches("input,textarea,select")
  ) {
    e.preventDefault();
    deleteSelectedLink(active);
    return;
  }
  if (e.key === "Escape" && active) {
    clearLinkSelection(active);
    return;
  }
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === "n") {
    e.preventDefault();
    newWorkspace();
  }
  if (e.key.toLowerCase() === "s") {
    e.preventDefault();
    command("save");
  }
  if (e.key.toLowerCase() === "z") {
    e.preventDefault();
    command("undo");
  }
  if (e.key.toLowerCase() === "w") {
    e.preventDefault();
    command("close");
  }
});
newWorkspace();
if (document.modelContext?.registerTool) {
  const life = new AbortController(),
    reg = (t) => Promise.resolve(document.modelContext.registerTool(t, { signal: life.signal })).catch(() => {});
  reg({
    name: "create_workspace",
    title: "สร้าง Workspace",
    description: "เปิดหน้าต่างจำลองเครือข่ายใหม่",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (i) => {
      const w = newWorkspace(i);
      return { id: w.id, name: w.name };
    },
  });
  reg({
    name: "get_desktop_state",
    title: "ดูสถานะ Desktop",
    description: "อ่าน Workspace และจำนวนอุปกรณ์ทั้งหมด",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => ({
      workspaces: windows.map((w) => ({ id: w.id, name: w.name, devices: w.nodes.length, links: w.links.length })),
    }),
  });
}
