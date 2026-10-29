// CAI layer: connects the Net Desktop UI (app.js) to the backend — login, saving, the Network
// Engine (live checks, ping, terminal), Mission Control, quizzes, survey and the CAI Assistant.
// app.js calls into this file through window.CAI, which is only set after the learner logs in.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const closeDialog = () => $("#dialog").open && $("#dialog").close();
  const TYPE_LABEL = { router: "Router", switch: "Switch", pc: "Computer", laptop: "Notebook", server: "Server", access: "Access Point" };
  const MEDAL = { gold: "🥇 เหรียญทอง", silver: "🥈 เหรียญเงิน", bronze: "🥉 เหรียญทองแดง" };
  let user = null;
  let missionCache = null;
  let leaving = false; // set once the learner chose to log out, so the page can reload without asking

  const wsData = (w) => ({
    nodes: w.nodes,
    links: w.links,
    notes: w.notes,
    strokes: w.strokes,
    ...(w.attemptId ? { missionAttemptId: w.attemptId } : {}),
  });
  const fingerprint = (w) => JSON.stringify([w.name, w.nodes, w.links, w.notes, w.strokes]);
  const baseline = (w) => {
    w.savedJson = fingerprint(w);
    w.dirty = false;
  };
  const isChanged = (w) => w.dirty && fingerprint(w) !== w.savedJson;
  const fail = (e) => toast(e.message || "เกิดข้อผิดพลาด");
  const needWorkspace = () => {
    if (!active) toast("เปิด Workspace ก่อน");
    return active;
  };
  const deviceOptions = (w, selectedId) =>
    w.nodes
      .map((n) => `<option value="${esc(n.id)}" ${n.id === selectedId ? "selected" : ""}>${esc(n.name)} (${TYPE_LABEL[n.type]})</option>`)
      .join("");
  const flash = (w, ids) =>
    ids.forEach((id) => {
      const el = w.el.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.classList.remove("pulse-node");
      void el.offsetWidth;
      el.classList.add("pulse-node");
      setTimeout(() => el.classList.remove("pulse-node"), 2400);
    });
  const fmtTime = (s) =>
    s ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.replace(" ", "T") + "Z")) : "";

  // ================= Login =================
  const loginScreen = $("#loginScreen");
  function showLogin(message) {
    window.CAI = undefined;
    loginScreen.hidden = false;
    $("#loginStatus").textContent = message || "";
    $("#loginStatus").hidden = !message;
    $("#loginFields").hidden = false;
    setTimeout(() => $("#loginId").focus(), 50);
  }
  function showServerDown(message) {
    loginScreen.hidden = false;
    $("#loginFields").hidden = true;
    $("#loginStatus").hidden = false;
    $("#loginStatus").innerHTML = `${esc(message)}<br><small>เปิดเซิร์ฟเวอร์ด้วยคำสั่ง <code>npm start</code> ในโฟลเดอร์ backend แล้วเข้าที่ http://localhost:3000</small><br><button type="button" id="retryBoot">ลองใหม่</button>`;
    $("#retryBoot").onclick = boot;
  }
  async function boot() {
    $("#loginStatus").hidden = false;
    $("#loginStatus").textContent = "กำลังเชื่อมต่อเซิร์ฟเวอร์…";
    $("#loginFields").hidden = true;
    try {
      const { user: u } = await api.me();
      if (u?.role === "student") return enter(u);
      if (u?.role === "teacher") {
        showLogin("ตอนนี้เข้าสู่ระบบในฐานะครู — ไปที่หน้าครู หรือเข้าสู่ระบบด้วยรหัสนักเรียน");
        return;
      }
      showLogin();
    } catch (e) {
      showServerDown(e.message);
    }
  }
  $("#loginId").addEventListener("input", (e) => ($("#idWarn").hidden = !/[฀-๿]/.test(e.target.value)));
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    btn.disabled = true;
    try {
      const { user: u } = await api.loginStudent($("#loginId").value.trim(), $("#loginName").value.trim());
      enter(u, true);
    } catch (err) {
      $("#loginStatus").hidden = false;
      $("#loginStatus").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  window.onSessionExpired = () => {
    if (user) showLogin("หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง");
    user = null;
  };

  async function enter(u, fresh) {
    user = u;
    $("#userName").textContent = u.name;
    loginScreen.hidden = true;
    window.CAI = CAI;
    windows.forEach((w) => {
      if (w.savedJson === undefined) baseline(w);
      scheduleAnalysis(w);
    });
    toast(`ยินดีต้อนรับ ${u.name}`);
    try {
      const p = await api.progress();
      if (!p.pretest) {
        showDialog(
          "ยินดีต้อนรับสู่ CAI Net",
          `<div class="assistant-box"><div class="assistant-face"></div><div><p>สวัสดีครับ <b>${esc(u.name)}</b>!</p><p>ก่อนเริ่มเรียน ลองทำ <b>แบบทดสอบก่อนเรียน</b> 10 ข้อ เพื่อวัดความรู้เดิมนะครับ (ไม่มีผลต่อคะแนนภารกิจ)</p></div></div><div class="dialog-actions"><button id="laterPre">ไว้ทีหลัง</button> <button class="primary-btn" id="startPre">เริ่มทำแบบทดสอบ</button></div>`,
          { noClose: true },
        );
        $("#startPre").onclick = () => openQuiz("pretest");
        $("#laterPre").onclick = closeDialog;
      } else if (fresh) {
        toast(`ผ่านภารกิจแล้ว ${p.missionsPassed}/${p.missionsTotal} — เปิด Mission Control ใน Dock เพื่อเรียนต่อ`);
      }
    } catch (e) {
      fail(e);
    }
  }
  async function logout(force) {
    // Saved workspaces are saved automatically; never-saved ones would be lost, so ask first.
    const unsaved = windows.filter((w) => !w.serverId && isChanged(w));
    if (unsaved.length && !force) {
      showDialog(
        "ออกจากระบบ",
        `<p>มี Workspace ที่ยังไม่เคยบันทึก ${unsaved.length} งาน: <b>${unsaved.map((w) => esc(w.name)).join(", ")}</b></p><p>ถ้าออกจากระบบตอนนี้ งานเหล่านี้จะหายไป</p><div class="dialog-actions"><button id="loCancel">ยกเลิก</button> <button id="loDiscard" class="danger-btn">ออกโดยไม่บันทึก</button> <button id="loSave" class="primary-btn">บันทึกแล้วออก</button></div>`,
        { noClose: true },
      );
      $("#loCancel").onclick = closeDialog;
      $("#loDiscard").onclick = () => logout(true);
      $("#loSave").onclick = async () => {
        for (const w of unsaved) if (!(await save(w, true))) return toast(`บันทึก "${w.name}" ไม่สำเร็จ`);
        logout(true);
      };
      return;
    }
    await saveAllChanged();
    try {
      await api.logout();
    } catch {
      /* already logged out */
    }
    leaving = true;
    location.reload();
  }

  // ================= Live analysis =================
  function scheduleAnalysis(w) {
    clearTimeout(w._analysisTimer);
    w._analysisTimer = setTimeout(() => runAnalysis(w), 350);
  }
  async function runAnalysis(w) {
    if (!w.el.isConnected || !window.CAI) return;
    const seq = (w._analysisSeq = (w._analysisSeq || 0) + 1);
    try {
      const res = await api.analyze(wsData(w));
      if (seq !== w._analysisSeq) return; // a newer request is on its way
      w.analysis = res;
      applyAnalysis(w);
    } catch {
      /* status bar simply stays as is */
    }
    return w.analysis;
  }
  function applyAnalysis(w) {
    const a = w.analysis;
    if (!a) return;
    const byId = new Map(a.devices.map((d) => [d.id, d]));
    w.el.querySelectorAll(".node").forEach((el) => {
      const d = byId.get(el.dataset.id);
      el.classList.toggle("st-error", d?.status === "error");
      el.classList.toggle("st-warning", d?.status === "warning");
      const n = w.nodes.find((x) => x.id === el.dataset.id);
      if (n?.dhcp) {
        let ipEl = el.querySelector(".node-ip");
        if (!ipEl) {
          ipEl = document.createElement("span");
          ipEl.className = "node-ip";
          el.querySelector(".node-name").after(ipEl);
        }
        ipEl.textContent = d?.ip || "DHCP";
      }
    });
    const bar = w.el.querySelector("[data-net-status]");
    const { errors, warnings } = a.stats;
    bar.className = "net-status " + (errors ? "bad" : warnings ? "warn" : "good");
    bar.textContent = errors
      ? `⚠ พบ ${errors} ปัญหา — กด "ทดสอบเครือข่าย"`
      : warnings
        ? `△ มีข้อควรระวัง ${warnings} รายการ`
        : a.stats.devices
          ? "✓ เครือข่ายพร้อมใช้งาน"
          : "เริ่มเพิ่มอุปกรณ์จาก Sidebar";
    const n = getSelected(w);
    if (n) {
      // Refresh leased values without re-running updateInspector (which would schedule another analysis).
      if (n.dhcp) {
        const d = byId.get(n.id);
        ["ip", "mask", "gateway", "dns"].forEach((f) => (w.el.querySelector(`[data-field=${f}]`).value = d?.[f] || ""));
      }
      renderDeviceStatus(w, n);
    }
  }
  function renderDeviceStatus(w, n) {
    const box = w.el.querySelector("[data-device-status]");
    const a = w.analysis;
    if (!box) return;
    if (!a) return (box.innerHTML = "");
    const d = a.devices.find((x) => x.id === n.id);
    const mine = a.issues.filter((i) => i.deviceIds.includes(n.id));
    const info = d?.source === "dhcp" ? '<div class="ds-info">ได้รับ IP จาก DHCP</div>' : d?.source === "apipa" ? '<div class="ds-info">ขอ IP จาก DHCP ไม่สำเร็จ (APIPA)</div>' : "";
    box.innerHTML =
      info +
      (mine.length
        ? mine.map((i) => `<div class="ds-${i.severity}">${i.severity === "error" ? "⚠" : "△"} ${esc(i.message)}</div>`).join("")
        : '<div class="ds-ok">✓ อุปกรณ์นี้ไม่มีปัญหา</div>');
  }

  // ================= Test network =================
  async function testNetwork(w) {
    let a;
    try {
      a = await api.analyze(wsData(w));
    } catch (e) {
      return fail(e);
    }
    w.analysis = a;
    applyAnalysis(w);
    const s = a.stats;
    const statRow = `<div class="test-stats"><span><b>${s.devices}</b> อุปกรณ์</span><span><b>${s.workingLinks}/${s.links}</b> การเชื่อมต่อใช้งานได้</span><span><b>${s.hostsOnline}</b> เครื่องออนไลน์</span><span><b>${s.wifiClients}</b> Wi-Fi</span></div>`;
    if (!a.issues.length) {
      showDialog(
        "ผลการทดสอบเครือข่าย",
        `<div class="test-ok">✅ ทดสอบผ่าน ไม่พบปัญหาในเครือข่าย</div>${statRow}<p class="hint-line">💡 ลองใช้ <b>Network Utility</b> หรือ <b>Terminal</b> ใน Dock เพื่อ ping ระหว่างเครื่อง</p>`,
      );
      return;
    }
    flash(w, [...new Set(a.issues.flatMap((i) => i.deviceIds))]);
    showDialog(
      "ผลการทดสอบเครือข่าย",
      `${statRow}<ul class="issue-list">${a.issues
        .map((i) => `<li class="${i.severity}"><span>${i.severity === "error" ? "⚠" : "△"}</span>${esc(i.message)}</li>`)
        .join("")}</ul><p class="hint-line">💡 ไม่รู้จะแก้ยังไง? คลิกมาสคอต <b>CAI Assistant</b> ใน Dock เพื่อขอคำใบ้</p>`,
      { wide: true },
    );
  }

  // ================= Packet journey =================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function animatePath(w, path, ok) {
    const scene = w.el.querySelector(".canvas-scene");
    const nodes = path.map((id) => w.nodes.find((n) => n.id === id)).filter(Boolean);
    if (!nodes.length) return;
    const route = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const points = nodes
      .map((n) => {
        const p = center(n);
        return `${p.x},${p.y}`;
      })
      .join(" ");
    route.classList.add("packet-route");
    route.setAttribute("viewBox", `0 0 ${scene.clientWidth} ${scene.clientHeight}`);
    route.setAttribute("preserveAspectRatio", "none");
    route.innerHTML = `<polyline class="packet-route-glow" points="${points}"></polyline><polyline class="packet-route-flow" points="${points}"></polyline>`;
    scene.appendChild(route);
    const env = document.createElement("div");
    env.className = "packet packet-hop";
    env.innerHTML = '<span class="packet-symbol">✉</span><span class="packet-label">กำลังส่ง</span>';
    const label = env.querySelector(".packet-label");
    const place = (n) => {
      const p = center(n);
      env.style.left = p.x + "px";
      env.style.top = p.y + "px";
    };
    place(nodes[0]);
    scene.appendChild(env);
    flash(w, [nodes[0].id]);
    for (let i = 1; i < nodes.length; i++) {
      label.textContent = `ฮอป ${i} / ${nodes.length - 1}`;
      env.classList.add("packet-moving");
      await sleep(140);
      place(nodes[i]);
      await sleep(700);
      env.classList.remove("packet-moving");
      flash(w, [nodes[i].id]);
    }
    if (!ok) {
      env.classList.add("packet-fail");
      env.querySelector(".packet-symbol").textContent = "✕";
      label.textContent = "ส่งไม่สำเร็จ";
      await sleep(1000);
    } else {
      env.classList.add("packet-success");
      env.querySelector(".packet-symbol").textContent = "✓";
      label.textContent = "ถึงปลายทางแล้ว";
      await sleep(650);
    }
    env.remove();
    route.classList.add("packet-route-out");
    await sleep(220);
    route.remove();
  }
  async function sendPacket(w, a, b) {
    let res;
    try {
      res = await api.ping(wsData(w), a.id, b.id, 1);
    } catch (e) {
      return fail(e);
    }
    await animatePath(w, res.path?.length ? res.path : [a.id], res.ok);
    if (res.ok) {
      const names = res.path.map((id) => w.nodes.find((n) => n.id === id)?.name).filter(Boolean);
      toast(`ส่ง Packet สำเร็จ: ${names.join(" → ")}`);
    } else {
      showDialog(
        "ส่ง Packet ไม่สำเร็จ",
        `<p>${esc(res.message)}</p>${res.hint ? `<p class="hint-line">💡 ${esc(res.hint)}</p>` : ""}<pre class="term-out small">${esc(res.lines.join("\n"))}</pre>`,
      );
    }
  }

  // ================= Save / Finder =================
  async function save(w, quiet) {
    if (!w) return;
    try {
      if (w.serverId) await api.updateWorkspace(w.serverId, w.name, wsData(w));
      else w.serverId = (await api.createWorkspace(w.name, wsData(w), w.missionId)).workspace.id;
      baseline(w);
      if (!quiet) toast(`บันทึก "${w.name}" แล้ว`);
      return true;
    } catch (e) {
      if (!quiet || e.status !== 401) fail(e);
      return false;
    }
  }
  async function saveAllChanged() {
    for (const w of windows) if (w.serverId && isChanged(w)) await save(w, true);
  }
  setInterval(() => {
    if (window.CAI) saveAllChanged();
  }, 20000);
  // Closing or reloading the tab (Chrome also closes the tab on Ctrl+W) would lose unsaved work: ask first.
  window.addEventListener("beforeunload", (e) => {
    if (leaving || !window.CAI || !windows.some(isChanged)) return;
    e.preventDefault();
    e.returnValue = "";
  });

  function confirmClose(w) {
    if (!isChanged(w)) return closeWorkspace(w, true);
    showDialog(
      "ปิด Workspace",
      `<p>บันทึกการเปลี่ยนแปลงใน "<b>${esc(w.name)}</b>" ก่อนปิดไหม?</p><div class="dialog-actions"><button id="ccCancel">ยกเลิก</button> <button id="ccDiscard" class="danger-btn">ไม่บันทึก</button> <button id="ccSave" class="primary-btn">บันทึก</button></div>`,
      { noClose: true },
    );
    $("#ccCancel").onclick = closeDialog;
    $("#ccDiscard").onclick = () => {
      closeDialog();
      closeWorkspace(w, true);
    };
    $("#ccSave").onclick = async () => {
      if (await save(w)) {
        closeDialog();
        closeWorkspace(w, true);
      }
    };
  }

  function openWorkspaceRecord(rec) {
    const open = windows.find((w) => w.serverId === rec.id);
    if (open) return focusWindow(open);
    const w = newWorkspace({ ...rec.data, name: rec.name, serverId: rec.id, missionId: rec.missionId });
    w.el.querySelector(".window-title").textContent = w.name;
    baseline(w);
    if (rec.missionId) attachMission(w, rec.missionId);
    return w;
  }

  async function openFinder() {
    let list;
    try {
      list = (await api.listWorkspaces()).workspaces;
    } catch (e) {
      return fail(e);
    }
    const legacy = localStorage.getItem("cainet.workspace");
    showDialog(
      "Finder — งานที่บันทึกไว้",
      `<div class="finder-top"><span>${list.length ? `${list.length} งาน` : "ยังไม่มีงานที่บันทึก"}</span>${active ? '<button id="finderSave" class="primary-btn">บันทึกงานที่เปิดอยู่</button>' : ""}${legacy ? '<button id="finderLegacy">นำเข้างานเก่าในเครื่อง</button>' : ""}</div>
      <div class="finder-list">${list
        .map(
          (r) =>
            `<div class="finder-row" data-id="${r.id}"><span class="finder-icon">${r.missionId ? "🎯" : "▣"}</span><div class="finder-name"><b>${esc(r.name)}</b><small>แก้ไขล่าสุด ${esc(fmtTime(r.updatedAt))}</small></div><button data-open="${r.id}">เปิด</button><button data-del="${r.id}" class="danger-btn">ลบ</button></div>`,
        )
        .join("")}</div>`,
      { wide: true },
    );
    $("#finderSave")?.addEventListener("click", async () => {
      if (await save(active)) openFinder();
    });
    $("#finderLegacy")?.addEventListener("click", () => {
      const w = newWorkspace(JSON.parse(legacy));
      baseline(w);
      w.dirty = true;
      closeDialog();
      save(w).then((ok) => ok && localStorage.removeItem("cainet.workspace"));
    });
    document.querySelectorAll(".finder-row [data-open]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            const { workspace } = await api.getWorkspace(b.dataset.open);
            closeDialog();
            openWorkspaceRecord(workspace);
          } catch (e) {
            fail(e);
          }
        }),
    );
    document.querySelectorAll(".finder-row [data-del]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!b.classList.contains("confirm")) {
            b.classList.add("confirm");
            b.textContent = "ยืนยันลบ?";
            return;
          }
          try {
            await api.deleteWorkspace(b.dataset.del);
            windows.filter((w) => w.serverId === Number(b.dataset.del)).forEach((w) => (w.serverId = null));
            openFinder();
          } catch (e) {
            fail(e);
          }
        }),
    );
  }

  // ================= Missions =================
  async function loadMissions() {
    missionCache = (await api.missions()).missions;
    return missionCache;
  }
  function attachMission(w, missionId) {
    w.missionId = missionId;
    w.el.querySelector(".mission-check").hidden = false;
    w.el.classList.add("mission-window");
    const show = (m) => {
      w.mission = m;
      renderMissionPanel(w);
    };
    const m = missionCache?.find((x) => x.id === missionId);
    if (m) show(m);
    else loadMissions().then((ms) => show(ms.find((x) => x.id === missionId))).catch(fail);
  }
  function renderMissionPanel(w) {
    const panel = w.el.querySelector(".mission-panel");
    const m = w.mission;
    if (!m) return;
    const results = new Map((w.missionResults || []).map((r) => [r.id, r.pass]));
    panel.hidden = false;
    panel.innerHTML = `<h2 class="panel-title">🎯 ภารกิจ ${m.order}</h2><div class="mp-title">${esc(m.title)}</div><ul class="mp-checks">${m.checks
      .map((c) => {
        const r = results.get(c.id);
        return `<li class="${r === true ? "pass" : r === false ? "fail" : ""}">${r === true ? "✓" : r === false ? "✗" : "○"} ${esc(c.label)}</li>`;
      })
      .join("")}</ul><div class="size-row"><button class="small-btn mp-brief">📋 ดูโจทย์</button>${m.lesson ? '<button class="small-btn mp-lesson">📖 บทเรียน</button>' : ""}</div>`;
    panel.querySelector(".mp-brief").onclick = () => showBrief(m);
    panel.querySelector(".mp-lesson")?.addEventListener("click", () => openLesson(m.lesson.id));
  }
  function showBrief(m) {
    showDialog(
      `ภารกิจ ${m.order}: ${m.title}`,
      `<p>${esc(m.story)}</p><b>เงื่อนไขผ่านภารกิจ</b><ul class="brief-checks">${m.checks.map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul>${m.allowed?.length ? `<p class="hint-line">อุปกรณ์ที่ใช้ในภารกิจนี้: ${m.allowed.map((t) => TYPE_LABEL[t]).join(", ")}</p>` : ""}<p class="hint-line">เมื่อทำเสร็จ กดปุ่ม <b>🎯 ตรวจภารกิจ</b> ที่มุมขวาบนของหน้าต่าง · ติดตรงไหนคลิกมาสคอตเพื่อขอคำใบ้ (คำใบ้มีผลต่อคะแนนเล็กน้อย)</p>`,
      { wide: true },
    );
  }
  async function startMission(id) {
    try {
      const res = await api.startMission(id);
      closeDialog();
      const w = newWorkspace({ ...res.template, name: `ภารกิจ ${res.mission.order}: ${res.mission.title}`, missionId: id, missionAttemptId: res.attemptId });
      w.el.querySelector(".window-title").textContent = w.name;
      w.el.classList.add("maximized");
      attachMission(w, id);
      baseline(w);
      w.dirty = true;
      await save(w, true);
      showBrief(res.mission);
    } catch (e) {
      fail(e);
    }
  }
  async function checkMission(w) {
    if (!w.attemptId) return toast("Workspace นี้ไม่ใช่ภารกิจ");
    let res;
    try {
      res = await api.checkMission(w.missionId, w.attemptId, wsData(w));
    } catch (e) {
      return fail(e);
    }
    w.missionResults = res.results;
    renderMissionPanel(w);
    save(w, true);
    missionCache = null;
    if (res.passed) {
      showDialog(
        "🎉 ผ่านภารกิจ!",
        `<div class="medal-box"><div class="medal ${res.medal}">${res.medal === "gold" ? "🥇" : res.medal === "silver" ? "🥈" : "🥉"}</div><div><div class="medal-score">${res.score} คะแนน</div><div>${MEDAL[res.medal]}</div><small>ตรวจ ${res.checks} ครั้ง · ใช้คำใบ้ ${res.hints} ครั้ง</small></div></div><p>ตอบคำถามสั้น ๆ หลังภารกิจเพื่อทบทวนความเข้าใจ</p><div class="dialog-actions"><button id="mLater">ไว้ทีหลัง</button> <button id="mQuiz" class="primary-btn">ตอบคำถามหลังภารกิจ</button></div>`,
        { noClose: true },
      );
      $("#mLater").onclick = closeDialog;
      $("#mQuiz").onclick = () => openQuiz(res.quiz);
    } else {
      const failed = res.results.filter((r) => !r.pass);
      showDialog(
        "ยังไม่ผ่านภารกิจ",
        `<p>ผ่านแล้ว ${res.results.length - failed.length}/${res.results.length} เงื่อนไข</p><ul class="issue-list">${failed.map((r) => `<li class="error"><span>✗</span>${esc(r.label)}</li>`).join("")}</ul>${res.issues.length ? `<p class="hint-line">พบปัญหาในเครือข่าย ${res.issues.length} รายการ — กด "ทดสอบเครือข่าย" เพื่อดูรายละเอียด</p>` : ""}<p class="hint-line">💡 คลิกมาสคอต CAI Assistant เพื่อขอคำใบ้</p>`,
      );
    }
  }
  async function missionControl() {
    let ms, p;
    try {
      [ms, p] = await Promise.all([loadMissions(), api.progress()]);
    } catch (e) {
      return fail(e);
    }
    const step = (done, label, cmd) => `<button class="step ${done ? "done" : ""}" data-cmd2="${cmd}">${done ? "✓" : "○"} ${label}</button>`;
    const card = (m) => {
      const status = !m.unlocked
        ? `🔒 ผ่านภารกิจที่ ${m.order - 1} ก่อน`
        : m.passed
          ? `คะแนนสูงสุด ${m.bestScore}`
          : m.attempts
            ? `เริ่มแล้ว ${m.attempts} ครั้ง`
            : "ยังไม่เริ่ม";
      const lesson = m.lesson
        ? `<button class="mc-lesson ${m.lesson.read ? "read" : ""}" data-lesson="${esc(m.lesson.id)}">${m.lesson.read ? "✓" : "📖"} บทเรียน: ${esc(m.lesson.title)}</button>`
        : "";
      const start = m.unlocked
        ? `<button data-mission="${m.id}" class="${m.passed ? "" : "primary-btn"}">${m.passed ? "เล่นอีกครั้ง" : m.attempts ? "เริ่มใหม่" : "เริ่มภารกิจ"}</button>`
        : '<button disabled>🔒 ยังไม่ปลดล็อก</button>';
      return `<div class="mc-card ${m.passed ? "passed" : ""} ${m.unlocked ? "" : "locked"}"><div class="mc-head"><span class="mc-num">${m.order}</span>${m.medal ? `<span class="mc-medal">${MEDAL[m.medal]}</span>` : ""}</div><b>${esc(m.title)}</b><p>${esc(m.summary)}</p>${lesson}<small>${status}</small>${start}</div>`;
    };
    showDialog(
      "Mission Control",
      `<div class="mc-steps">${step(p.pretest, "1. แบบทดสอบก่อนเรียน", "pretest")}${step(p.missionsPassed === p.missionsTotal, `2. บทเรียน + ภารกิจ (${p.missionsPassed}/${p.missionsTotal})`, "")}${step(p.posttest, "3. แบบทดสอบหลังเรียน", "posttest")}${step(p.survey, "4. แบบประเมินความพึงพอใจ", "survey")}</div>
      <p class="hint-line">อ่านบทเรียนก่อนเริ่มแต่ละภารกิจ แล้วทำภารกิจตามลำดับ ภารกิจถัดไปจะปลดล็อกเมื่อผ่านภารกิจก่อนหน้า</p>
      <div class="mc-grid">${ms.map(card).join("")}</div>`,
      { wide: true },
    );
    document.querySelectorAll("[data-mission]").forEach((b) => (b.onclick = () => startMission(b.dataset.mission)));
    document.querySelectorAll("[data-lesson]").forEach((b) => (b.onclick = () => openLesson(b.dataset.lesson)));
    document.querySelectorAll("[data-cmd2]").forEach((b) => b.dataset.cmd2 && (b.onclick = () => command2(b.dataset.cmd2)));
  }

  // ================= Lessons =================
  async function openLesson(id) {
    let data, ms;
    try {
      [data, ms] = await Promise.all([api.lesson(id), loadMissions()]);
    } catch (e) {
      return fail(e);
    }
    const l = data.lesson;
    const m = ms.find((x) => x.id === l.mission);
    const section = (s) =>
      `<section class="lesson-sec"><h3>${esc(s.h)}</h3>${(s.p || []).map((t) => `<p>${esc(t)}</p>`).join("")}${s.list ? `<ul>${s.list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}${s.code ? `<pre class="lesson-code">${esc(s.code.join("\n"))}</pre>` : ""}${s.tip ? `<div class="lesson-tip">💡 ${esc(s.tip)}</div>` : ""}</section>`;
    showDialog(
      `บทเรียนที่ ${l.order}: ${l.title}`,
      `<div class="lesson-goal">🎯 เป้าหมาย: ${esc(l.goal)}</div>${l.sections.map(section).join("")}<div class="dialog-actions"><button id="lsClose">ปิด</button> ${m?.unlocked ? `<button id="lsGo" class="primary-btn">อ่านจบแล้ว ไปทำภารกิจที่ ${m.order}</button>` : `<button id="lsDone" class="primary-btn">อ่านจบแล้ว ✓</button>`}</div>`,
      { wide: true, noClose: true },
    );
    $("#dialogBody").scrollTop = 0;
    const markRead = () => api.markLessonRead(l.id).catch(fail);
    $("#lsClose").onclick = closeDialog;
    $("#lsDone")?.addEventListener("click", async () => {
      await markRead();
      missionControl();
    });
    $("#lsGo")?.addEventListener("click", async () => {
      await markRead();
      startMission(l.mission);
    });
  }

  // ================= Quizzes & survey =================
  async function openQuiz(id) {
    let data;
    try {
      data = await api.quiz(id);
    } catch (e) {
      return fail(e);
    }
    const { quiz } = data;
    const started = Date.now();
    const intro =
      id === "pretest"
        ? "ทำตามความรู้เดิมของตัวเอง ไม่ต้องกังวลเรื่องคะแนน"
        : id === "posttest"
          ? "ทำหลังจากเรียนและทำภารกิจครบแล้ว"
          : "ตอบคำถามเพื่อทบทวนสิ่งที่ได้จากภารกิจ";
    showDialog(
      quiz.title,
      `<p class="hint-line">${intro}${data.lastResult ? ` · ครั้งล่าสุดได้ ${data.lastResult.score}/${data.lastResult.total}` : ""}</p><form id="quizForm" class="quiz">${quiz.questions
        .map(
          (q, i) =>
            `<fieldset data-q="${q.id}"><legend>${i + 1}. ${esc(q.q)}</legend>${q.choices
              .map((c, k) => `<label><input type="radio" name="${q.id}" value="${k}"> ${esc(c)}</label>`)
              .join("")}<div class="explain" hidden></div></fieldset>`,
        )
        .join("")}<div class="dialog-actions"><button type="button" id="quizCancel">ยกเลิก</button> <button type="submit" class="primary-btn">ส่งคำตอบ</button></div></form>`,
      { wide: true, noClose: true },
    );
    $("#quizCancel").onclick = closeDialog;
    $("#quizForm").onsubmit = async (e) => {
      e.preventDefault();
      const answers = {};
      let missing = 0;
      quiz.questions.forEach((q) => {
        const v = document.querySelector(`input[name="${q.id}"]:checked`);
        if (v) answers[q.id] = Number(v.value);
        else missing++;
      });
      if (missing) return toast(`ยังไม่ได้ตอบอีก ${missing} ข้อ`);
      let res;
      try {
        res = await api.submitQuiz(id, answers, (Date.now() - started) / 1000);
      } catch (err) {
        return fail(err);
      }
      showQuizResult(id, quiz, res);
    };
  }
  function showQuizResult(id, quiz, res) {
    // Mark answers in place and show explanations.
    res.results.forEach((r) => {
      const fs = document.querySelector(`fieldset[data-q="${r.id}"]`);
      fs.classList.add(r.correct ? "right" : "wrong");
      fs.querySelectorAll("label").forEach((l, k) => {
        if (k === r.answer) l.classList.add("answer");
        l.querySelector("input").disabled = true;
      });
      const ex = fs.querySelector(".explain");
      ex.hidden = false;
      ex.textContent = (r.correct ? "✓ ถูกต้อง — " : "✗ ยังไม่ถูก — ") + r.explain;
    });
    const form = $("#quizForm");
    form.querySelector(".dialog-actions").innerHTML =
      `<span class="quiz-score">ได้ ${res.score}/${res.total} คะแนน (${res.percent}%)</span> ` +
      (id === "posttest" ? '<button type="button" id="toSurvey" class="primary-btn">ทำแบบประเมินความพึงพอใจ</button> ' : "") +
      '<button type="button" id="quizDone">ปิด</button>';
    $("#quizDone").onclick = closeDialog;
    $("#toSurvey")?.addEventListener("click", openSurvey);
    form.insertAdjacentHTML("afterbegin", `<div class="quiz-banner">ได้ ${res.score}/${res.total} คะแนน (${res.percent}%) — เลื่อนดูเฉลยและคำอธิบายแต่ละข้อได้เลย</div>`);
    $("#dialogBody").scrollTop = 0;
  }
  async function openSurvey() {
    let data;
    try {
      data = await api.survey();
    } catch (e) {
      return fail(e);
    }
    const { survey, done } = data;
    showDialog(
      "แบบประเมินความพึงพอใจ",
      `${done ? '<p class="hint-line">คุณเคยตอบแล้ว ส่งใหม่ได้ (ระบบจะใช้คำตอบล่าสุด)</p>' : ""}<form id="surveyForm"><table class="survey"><thead><tr><th>รายการประเมิน</th>${[5, 4, 3, 2, 1].map((v) => `<th title="${survey.scale[v - 1]}">${v}</th>`).join("")}</tr></thead><tbody>${survey.items
        .map((t, i) => `<tr><td>${i + 1}. ${esc(t)}</td>${[5, 4, 3, 2, 1].map((v) => `<td><input type="radio" name="s${i}" value="${v}" aria-label="${survey.scale[v - 1]}"></td>`).join("")}</tr>`)
        .join("")}</tbody></table><small>5 = ${survey.scale[4]}, 4 = ${survey.scale[3]}, 3 = ${survey.scale[2]}, 2 = ${survey.scale[1]}, 1 = ${survey.scale[0]}</small><label class="survey-comment">ข้อเสนอแนะเพิ่มเติม<textarea id="surveyComment" maxlength="1000"></textarea></label><div class="dialog-actions"><button type="button" id="svCancel">ยกเลิก</button> <button type="submit" class="primary-btn">ส่งแบบประเมิน</button></div></form>`,
      { wide: true, noClose: true },
    );
    $("#svCancel").onclick = closeDialog;
    $("#surveyForm").onsubmit = async (e) => {
      e.preventDefault();
      const answers = survey.items.map((_, i) => Number(document.querySelector(`input[name="s${i}"]:checked`)?.value || 0));
      if (answers.includes(0)) return toast("กรุณาตอบให้ครบทุกข้อ");
      try {
        await api.submitSurvey(answers, $("#surveyComment").value);
        showDialog("ขอบคุณครับ", "<p>บันทึกแบบประเมินเรียบร้อยแล้ว ขอบคุณที่ร่วมใช้งาน CAI Net 🙏</p>");
      } catch (err) {
        fail(err);
      }
    };
  }
  async function showProgress() {
    let p, ms;
    try {
      [p, ms] = await Promise.all([api.progress(), loadMissions()]);
    } catch (e) {
      return fail(e);
    }
    showDialog(
      "ความคืบหน้าของฉัน",
      `<p><b>${esc(user.name)}</b> (${esc(user.studentId)})</p><ul class="progress-list"><li>${p.pretest ? "✓" : "○"} แบบทดสอบก่อนเรียน</li><li>${p.lessonsRead === p.lessonsTotal ? "✓" : "○"} อ่านบทเรียน ${p.lessonsRead}/${p.lessonsTotal} บท</li>${ms.map((m) => `<li>${m.passed ? "✓" : m.unlocked ? "○" : "🔒"} ภารกิจ ${m.order}: ${esc(m.title)} ${m.passed ? `— ${m.bestScore} คะแนน ${MEDAL[m.medal]}` : ""}</li>`).join("")}<li>${p.posttest ? "✓" : "○"} แบบทดสอบหลังเรียน</li><li>${p.survey ? "✓" : "○"} แบบประเมินความพึงพอใจ</li></ul>`,
    );
  }

  // ================= CAI Assistant =================
  async function assistant(w) {
    if (!w) {
      return showDialog(
        "CAI Assistant",
        `<div class="assistant-box"><div class="assistant-face"></div><div><p>สวัสดีครับ! เปิด Workspace หรือเริ่มภารกิจจาก <b>Mission Control</b> ใน Dock ได้เลย</p><p>เวลาติดปัญหา คลิกผมเพื่อขอคำใบ้ได้ทุกเมื่อ</p></div></div>`,
      );
    }
    let level = 1;
    const ask = async () => {
      let res;
      try {
        res = await api.hint(wsData(w), level, w.attemptId);
      } catch (e) {
        return fail(e);
      }
      if (res.highlight.length) flash(w, res.highlight);
      const more = res.hasProblem && level < 3;
      showDialog(
        "CAI Assistant",
        `<div class="assistant-box"><div class="assistant-face"></div><div><div class="hint-level">${res.hasProblem ? `คำใบ้ระดับ ${level}/3` : "เยี่ยมมาก!"}</div><p class="hint-text">${esc(res.text)}</p>${res.hasProblem && res.remaining > 1 ? `<small>ยังมีปัญหาอีก ${res.remaining - 1} จุด แก้ทีละจุดนะครับ</small>` : ""}</div></div><div class="dialog-actions">${more ? `<button id="hintMore" class="primary-btn">ขอคำใบ้เพิ่ม (ระดับ ${level + 1})</button> ` : ""}<button id="hintClose">เข้าใจแล้ว</button></div>`,
        { noClose: true },
      );
      $("#hintClose").onclick = closeDialog;
      $("#hintMore")?.addEventListener("click", () => {
        level++;
        ask();
      });
    };
    ask();
  }

  // ================= Network Utility =================
  function utility(w, tab = "ping") {
    w = w || needWorkspace();
    if (!w) return;
    if (!w.nodes.length) return toast("เพิ่มอุปกรณ์ก่อนใช้ Network Utility");
    const src = getSelected(w)?.id || w.nodes.find((n) => ["pc", "laptop", "server"].includes(n.type))?.id || w.nodes[0].id;
    const targets = (w.analysis?.devices || []).filter((d) => d.ip).map((d) => `<option value="${esc(d.ip)}">${esc(d.name)}</option><option value="${esc(d.hostname)}">${esc(d.name)} (ชื่อ DNS)</option>`).join("");
    const tabs = [
      ["info", "ข้อมูลเครือข่าย"],
      ["ping", "Ping"],
      ["trace", "Traceroute"],
      ["lookup", "Lookup (DNS)"],
    ];
    showDialog(
      "Network Utility",
      `<div class="nu-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="nu-form"><label>เครื่องต้นทาง<select id="nuSrc">${deviceOptions(w, src)}</select></label><label id="nuTargetWrap">ปลายทาง (IP หรือชื่อเครื่อง)<input id="nuTarget" list="nuTargets" placeholder="เช่น 192.168.1.1"></label><datalist id="nuTargets">${targets}</datalist><button id="nuRun" class="primary-btn">เริ่มทดสอบ</button></div>
      <pre class="term-out" id="nuOut">เลือกเครื่องต้นทางและปลายทาง แล้วกด "เริ่มทดสอบ"</pre><div class="nu-explain" id="nuExplain" hidden></div>`,
      { wide: true },
    );
    let current = tab,
      lastPath = null;
    const sync = () => {
      $("#nuTargetWrap").hidden = current === "info";
      document.querySelectorAll(".nu-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === current));
      $("#nuRun").textContent = { info: "แสดงข้อมูล", ping: "Ping", trace: "Trace", lookup: "Lookup" }[current];
    };
    document.querySelectorAll(".nu-tabs button").forEach(
      (b) =>
        (b.onclick = () => {
          current = b.dataset.tab;
          sync();
        }),
    );
    sync();
    $("#nuTarget").onkeydown = (e) => e.key === "Enter" && $("#nuRun").click();
    $("#nuRun").onclick = async () => {
      const from = $("#nuSrc").value,
        to = $("#nuTarget").value.trim();
      if (current !== "info" && !to) return toast("ใส่ปลายทางก่อน");
      $("#nuOut").textContent = "กำลังทดสอบ…";
      try {
        const data = wsData(w);
        const r =
          current === "info"
            ? await api.exec(data, from, "ipconfig /all")
            : current === "ping"
              ? await api.ping(data, from, to, 4)
              : current === "trace"
                ? await api.traceroute(data, from, to)
                : await api.exec(data, from, `nslookup ${to}`);
        $("#nuOut").textContent = r.lines.join("\n");
        $("#nuOut").className = "term-out " + (r.ok === false ? "bad" : "");
        lastPath = r.path?.length > 1 ? r.path : null;
        const ex = $("#nuExplain");
        ex.hidden = !r.message;
        ex.className = "nu-explain " + (r.ok ? "good" : "bad");
        ex.innerHTML = r.message ? `${r.ok ? "✓" : "✗"} ${esc(r.message)}${r.hint ? `<br>💡 ${esc(r.hint)}` : ""}${lastPath ? ' <button id="nuShow">ดูเส้นทางบนแผนผัง</button>' : ""}` : "";
        $("#nuShow")?.addEventListener("click", () => {
          closeDialog();
          animatePath(w, lastPath, r.ok);
        });
      } catch (e) {
        $("#nuOut").textContent = e.message;
      }
    };
  }

  // ================= Terminal =================
  function terminal(w) {
    w = w || needWorkspace();
    if (!w) return;
    if (!w.nodes.length) return toast("เพิ่มอุปกรณ์ก่อนใช้ Terminal");
    let deviceId = getSelected(w)?.id || w.nodes.find((n) => ["pc", "laptop", "server"].includes(n.type))?.id || w.nodes[0].id;
    const history = [];
    let hIndex = 0;
    const prompt = () => {
      const n = w.nodes.find((x) => x.id === deviceId);
      return `C:\\Users\\${(n?.name || "pc").replace(/\s+/g, "-")}>`;
    };
    showDialog(
      "Terminal",
      `<div class="term-bar"><label>เครื่อง <select id="tmDevice">${deviceOptions(w, deviceId)}</select></label><small>พิมพ์ <b>help</b> เพื่อดูคำสั่ง</small></div><div class="terminal" id="tmScreen"><pre id="tmOut">CAI Net Terminal — จำลองคำสั่งเครือข่ายของ Windows\nพิมพ์ help เพื่อดูคำสั่งทั้งหมด\n\n</pre><div class="term-line"><span id="tmPrompt"></span><input id="tmInput" autocomplete="off" spellcheck="false" aria-label="คำสั่ง"></div></div>`,
      { wide: true },
    );
    const out = $("#tmOut"),
      input = $("#tmInput"),
      screen = $("#tmScreen");
    const print = (text, cls) => {
      const span = document.createElement("span");
      if (cls) span.className = cls;
      span.textContent = text + "\n";
      out.appendChild(span);
      screen.scrollTop = screen.scrollHeight;
    };
    $("#tmPrompt").textContent = prompt();
    $("#tmDevice").onchange = (e) => {
      deviceId = e.target.value;
      $("#tmPrompt").textContent = prompt();
      print(`— เปลี่ยนไปใช้เครื่อง ${w.nodes.find((x) => x.id === deviceId)?.name} —`, "tm-note");
      input.focus();
    };
    screen.onclick = () => input.focus();
    input.focus();
    input.onkeydown = async (e) => {
      if (e.key === "ArrowUp" && history.length) {
        hIndex = Math.max(0, hIndex - 1);
        input.value = history[hIndex];
        e.preventDefault();
      } else if (e.key === "ArrowDown" && history.length) {
        hIndex = Math.min(history.length, hIndex + 1);
        input.value = history[hIndex] || "";
        e.preventDefault();
      } else if (e.key === "Enter") {
        const cmd = input.value.trim();
        input.value = "";
        print(prompt() + cmd);
        if (!cmd) return;
        history.push(cmd);
        hIndex = history.length;
        input.disabled = true;
        try {
          const r = await api.exec(wsData(w), deviceId, cmd);
          if (r.clear) out.textContent = "";
          else {
            if (r.lines.length) print(r.lines.join("\n"));
            if (r.message && r.ok === false) print(`ℹ ${r.message}${r.hint ? ` — ${r.hint}` : ""}`, "tm-note");
            print("");
          }
        } catch (err) {
          print(err.message, "tm-note");
        } finally {
          input.disabled = false;
          input.focus();
        }
      }
    };
  }

  // ================= Menu commands =================
  function command2(cmd) {
    if (cmd === "utility") utility(active);
    if (cmd === "terminal") terminal(active);
    if (cmd === "missions") missionControl();
    if (cmd === "pretest" || cmd === "posttest") openQuiz(cmd);
    if (cmd === "survey") openSurvey();
    if (cmd === "progress") showProgress();
    if (cmd === "logout") logout();
    if (cmd === "open") openFinder();
  }
  document.querySelector("[data-dock=utility]").onclick = () => window.CAI && utility(active);
  document.querySelector("[data-dock=terminal]").onclick = () => window.CAI && terminal(active);

  const CAI = {
    onChange: () => {},
    scheduleAnalysis,
    renderDeviceStatus,
    testNetwork,
    sendPacket,
    save,
    confirmClose,
    openFinder,
    missionControl,
    checkMission,
    assistant,
    command: command2,
  };
  boot();
})();
