// Navi: conversational network guide. It owns its UI and rule-based answers.
(() => {
  const conversation = [];
  const escapeHtml = (value) => String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
  const workspaceData = (workspace) => ({
    nodes: workspace.nodes,
    links: workspace.links,
    notes: workspace.notes,
    strokes: workspace.strokes,
    ...(workspace.attemptId ? { missionAttemptId: workspace.attemptId } : {}),
  });
  const flash = (workspace, ids) => ids.forEach((id) => {
    const element = workspace.el.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
    if (!element) return;
    element.classList.remove("pulse-node");
    void element.offsetWidth;
    element.classList.add("pulse-node");
    setTimeout(() => element.classList.remove("pulse-node"), 2400);
  });

  const TYPE_NAME = { router: "Router", switch: "Switch", pc: "Computer", laptop: "Notebook", server: "Server", access: "Access Point" };
  // Words learners use for a device type; used when the question names a type that has exactly one device.
  const TYPE_WORDS = {
    router: /router|เราเตอร์|เร้าเตอร์/,
    switch: /switch|สวิตช์|สวิทช์/,
    server: /server|เซิร์ฟเวอร์|เซิฟเวอร์/,
    laptop: /notebook|laptop|โน้ตบุ๊ก|โน๊ตบุ๊ค|โน้ตบุ๊ค/,
    pc: /\bpc\b|computer|คอมพิวเตอร์|คอม/,
    access: /access ?point|\bap\b|แอคเซสพอยต์/,
  };
  const compact = (text) => text.toLowerCase().replace(/[\s_-]+/g, "");

  // Devices named in the question, in the order they appear (e.g. "PC-01 ping Router" → [PC-01, Router]).
  function devicesInQuestion(lower, devices) {
    const text = compact(lower);
    const hits = [];
    const byLength = [...devices].sort((a, b) => b.name.length - a.name.length);
    let masked = text;
    for (const d of byLength) {
      for (const key of new Set([compact(d.name), compact(d.hostname)])) {
        const at = key ? masked.indexOf(key) : -1;
        if (at < 0) continue;
        hits.push({ device: d, at });
        masked = masked.slice(0, at) + "\u0000".repeat(key.length) + masked.slice(at + key.length);
        break;
      }
    }
    // Type words ("router", "สวิตช์") also count when that type has exactly one device,
    // e.g. "PC-01 ping Router" where the router is actually called "Router หลัก".
    for (const [type, re] of Object.entries(TYPE_WORDS)) {
      const ofType = devices.filter((d) => d.type === type);
      const m = re.exec(lower);
      // Convert the position to the compacted text so it can be ordered against the name hits.
      if (m && ofType.length === 1 && !hits.some((h) => h.device.id === ofType[0].id)) hits.push({ device: ofType[0], at: compact(lower.slice(0, m.index)).length });
    }
    return hits.sort((a, b) => a.at - b.at).map((h) => h.device);
  }

  const sourceLabel = { static: "ตั้งเอง / Static", dhcp: "รับอัตโนมัติจาก DHCP", apipa: "APIPA — ขอ IP จาก DHCP ไม่สำเร็จ", none: "ยังไม่ได้ตั้ง" };
  const connectionsOf = (analysis, d) => analysis.links
    .filter((l) => l.a === d.id || l.b === d.id)
    .map((l) => {
      const other = analysis.devices.find((x) => x.id === (l.a === d.id ? l.b : l.a));
      return `${other?.name || "?"} (${l.kind === "wireless" ? "Wi-Fi" : "สาย LAN"}${l.ok ? "" : " — ใช้งานไม่ได้"})`;
    });
  const issuesOf = (analysis, d) => analysis.issues.filter((i) => i.deviceIds.includes(d.id));
  const issueLines = (issues) => issues.map((i, k) => `${k + 1}. ${i.severity === "error" ? "⚠" : "△"} ${i.message}`).join("\n");

  // Facts about one device, read from the Network Engine's analysis (DHCP leases included).
  function deviceFacts(lower, analysis, node, d) {
    const wantIp = /\bip\b|ไอพี|address|ที่อยู่/.test(lower), wantMask = /mask|ซับเน็ต|subnet/.test(lower);
    const wantGw = /gateway|เกตเวย์|เกทเวย์/.test(lower), wantDns = /dns/.test(lower), wantMac = /\bmac\b/.test(lower);
    const wantWifi = /wi.?fi|ไวไฟ|ssid|ไร้สาย/.test(lower), wantLinks = /ต่อกับ|เชื่อมกับ|เชื่อมต่อ|ต่ออยู่|ติดกับ|ต่อสาย/.test(lower);
    const wantIssues = /ปัญหา|ผิด|error|เสีย/.test(lower);
    const lines = [];
    if (wantIp) lines.push(d.ip ? `IP Address: ${d.ip} (${sourceLabel[d.source] || d.source})` : `ยังไม่มี IP Address (${sourceLabel[d.source] || "ยังไม่ได้ตั้ง"})`);
    if (wantMask) lines.push(`Subnet Mask: ${d.ip ? d.mask : "-"}`);
    if (wantGw) lines.push(`Default Gateway: ${d.gateway || "ยังไม่ได้ตั้ง"}`);
    if (wantDns) lines.push(`DNS Server: ${d.dns || "ยังไม่ได้ตั้ง"}`);
    if (wantMac) lines.push(`MAC Address: ${d.mac}`);
    if (wantWifi) {
      if (!["router", "access", "laptop"].includes(d.type)) lines.push(`${TYPE_NAME[d.type]} ในแบบจำลองนี้ไม่มี Wi-Fi ใช้สาย LAN เท่านั้น`);
      else if (d.type === "laptop") lines.push(`Wi-Fi: ${node.wifi ? "เปิด" : "ปิด"} · เลือกเครือข่าย “${node.ssid || "-"}”`);
      else {
        const clients = analysis.links.filter((l) => l.kind === "wireless" && l.ok && (l.a === d.id || l.b === d.id)).length;
        lines.push(`Wi-Fi: ${node.wifi ? "เปิด" : "ปิด"} · กระจายชื่อ “${node.ssid || "-"}” · มีเครื่องเชื่อมอยู่ ${clients} เครื่อง`);
      }
    }
    if (wantLinks) {
      const c = connectionsOf(analysis, d);
      lines.push(c.length ? `เชื่อมต่อกับ: ${c.join(", ")}` : "ยังไม่ได้เชื่อมต่อกับอุปกรณ์ใด");
    }
    if (wantIssues) {
      const mine = issuesOf(analysis, d);
      lines.push(mine.length ? `ปัญหาที่พบ:\n${issueLines(mine)}` : "ไม่พบปัญหาที่อุปกรณ์นี้ครับ ✓");
    } else if (lines.length && issuesOf(analysis, d).length) {
      // Answering a specific question about a device that has problems: point them out without giving the fix.
      lines.push(`⚠ อุปกรณ์นี้มีปัญหา ${issuesOf(analysis, d).length} จุด — ถาม “${d.name} มีปัญหาอะไร” เพื่อดูรายละเอียด`);
    }
    if (!lines.length) {
      // Only the device was named: give a short profile.
      lines.push(`${TYPE_NAME[d.type]} · ${d.ip ? `IP ${d.ip}/${d.mask} (${sourceLabel[d.source]})` : "ยังไม่มี IP"}`);
      if (["pc", "laptop", "server"].includes(d.type)) lines.push(`Gateway ${d.gateway || "-"} · DNS ${d.dns || "-"}`);
      const c = connectionsOf(analysis, d);
      lines.push(c.length ? `เชื่อมต่อกับ: ${c.join(", ")}` : "ยังไม่ได้เชื่อมต่อกับอุปกรณ์ใด");
      const mine = issuesOf(analysis, d);
      lines.push(mine.length ? `ปัญหาที่พบ:\n${issueLines(mine)}` : "สถานะ: ไม่พบปัญหา ✓");
    }
    return `${d.name}\n${lines.join("\n")}`;
  }

  // hintState = { key, level }: hints climb 1 → 2 → 3 while the learner asks about the same problem,
  // and start again at level 1 when the first problem (or the workspace) changes.
  async function answer(workspace, user, question, hintState) {
    const query = question.trim(), lower = query.toLowerCase();
    if (!query) return { text: "ลองพิมพ์สิ่งที่อยากรู้ หรือเลือกคำถามแนะนำด้านล่างได้เลยครับ" };
    if (/สวัสดี|หวัดดี|hello|hi\b/.test(lower)) return { text: `สวัสดีครับ ${user?.name || ""} ผม Navi ผู้ช่วยนำทางเครือข่าย วันนี้อยากตรวจ Workspace หรือเรียนรู้เรื่องไหนครับ` };
    if (/ทำอะไรได้|ช่วยอะไร|ความสามารถ|help/.test(lower)) {
      return { text: "ถามผมเกี่ยวกับ Workspace ที่เปิดอยู่ได้ เช่น\n• “IP ของ PC-01 คืออะไร” · “Router ต่อกับอะไร” · “Notebook-01 ใช้ Wi-Fi ชื่ออะไร”\n• “PC-01 ping Router ได้ไหม”\n• “มีปัญหาอะไรบ้าง”\n• “ขอคำใบ้” / “แก้ยังไง” (ระหว่างภารกิจจะนับเป็นการใช้คำใบ้)\nและถามความรู้ เช่น “DHCP คืออะไร” ได้ครับ" };
    }

    const wantsFix = /คำใบ้|แก้ยังไง|แก้อย่างไร|แก้ไง|วิธีแก้|ช่วยแก้|บอกวิธี|ทำยังไงดี|ทำไงดี|ควรทำอะไร|ทำอะไรต่อ|ต่อไป/.test(lower);
    const wantsPing = /ping|ปิง|ติดต่อ.*ได้|ส่ง.*ถึง|ถึงกัน|คุยกัน/.test(lower);
    const wantsProblems = /ปัญหา|ผิดตรงไหน|อะไรผิด|ตรวจ|วิเคราะห์|error|ทำไม/.test(lower);

    // Questions about the open workspace (analyze and ping are free: they are not counted as hints).
    if (workspace && (wantsFix || wantsPing || wantsProblems || /\bip\b|ไอพี|mask|gateway|เกตเวย์|dns|wi.?fi|ssid|ต่อกับ|เชื่อม|mac/.test(lower) || workspace.nodes.some((n) => compact(lower).includes(compact(n.name))))) {
      let analysis;
      try {
        analysis = await api.analyze(workspaceData(workspace));
      } catch (error) {
        return { text: error.message };
      }
      const named = devicesInQuestion(lower, analysis.devices);

      if (wantsPing && named.length >= 2) {
        const [from, to] = named;
        const r = await api.ping(workspaceData(workspace), from.id, to.id, 1);
        if (r.path?.length) flash(workspace, r.path);
        const route = (r.path || []).map((id) => analysis.devices.find((d) => d.id === id)?.name).filter(Boolean).join(" → ");
        return {
          text: r.ok
            ? `✓ ${from.name} ส่งข้อมูลถึง ${to.name} ได้\nเส้นทาง: ${route}\n${r.message}`
            : `✗ ${from.name} ส่งข้อมูลถึง ${to.name} ไม่ได้\nสาเหตุ: ${r.message}${r.hint ? `\nลองดู: ${r.hint}` : ""}`,
        };
      }
      if (wantsPing && named.length === 1 && !wantsFix) {
        return { text: `อยากให้ทดสอบจาก ${named[0].name} ไปเครื่องไหนครับ ลองพิมพ์เช่น “${named[0].name} ping ${analysis.devices.find((d) => d.id !== named[0].id)?.name || "Router"} ได้ไหม”` };
      }

      if (wantsFix) {
        try {
          const first = analysis.issues[0];
          const key = `${workspace.id}|${first ? `${first.code}|${first.deviceIds.join(",")}` : "none"}`;
          hintState.level = key === hintState.key ? Math.min(hintState.level + 1, 3) : 1;
          hintState.key = key;
          const level = /ละเอียด|วิธีแก้|บอกวิธี/.test(lower) ? 3 : hintState.level;
          const result = await api.hint(workspaceData(workspace), level, workspace.attemptId);
          if (result.highlight.length) flash(workspace, result.highlight);
          const more = result.hasProblem && level < 3 ? "\nยังไม่เข้าใจ? ถาม “ขอคำใบ้” อีกครั้งเพื่อดูคำใบ้ละเอียดขึ้น" : "";
          return {
            text: result.hasProblem
              ? `คำใบ้ระดับ ${level}/3: ${result.text}${result.remaining > 1 ? `\n(ยังมีปัญหาอีก ${result.remaining - 1} จุด แก้ทีละจุดนะครับ)` : ""}${more}`
              : result.text,
          };
        } catch (error) {
          return { text: error.message };
        }
      }

      // "Router ทำหน้าที่อะไร" is a concept question even if a device is called "Router".
      const conceptual = /คืออะไร|ทำหน้าที่|หมายถึง|อธิบาย|ต่างกัน/.test(lower);
      const asksFacet = /\bip\b|ไอพี|mask|ซับเน็ต|gateway|เกตเวย์|dns|\bmac\b|wi.?fi|ไวไฟ|ssid|ต่อกับ|เชื่อม|ต่ออยู่|ปัญหา|ผิด/.test(lower);
      if (named.length && (asksFacet || !conceptual)) {
        const d = named[0];
        return { text: deviceFacts(lower, analysis, workspace.nodes.find((n) => n.id === d.id) || {}, d) };
      }

      // "Gateway / DNS ควรตั้งเป็นอะไร" → the router's address in this workspace.
      if (/gateway|เกตเวย์|เกทเวย์|dns/.test(lower) && /ควร|ตั้ง|ใส่|ใช้/.test(lower)) {
        const routers = analysis.devices.filter((d) => d.type === "router" && d.ip);
        if (routers.length) {
          return {
            text: `ใน “${workspace.name}” ให้ตั้ง Default Gateway${/dns/.test(lower) ? " และ DNS Server" : ""} เป็น IP ของ Router ที่อยู่วงเดียวกับเครื่อง:\n${routers.map((r) => `• ${r.name}: ${r.ip} (Mask ${r.mask})`).join("\n")}\nถ้าเครื่องใช้ DHCP จะได้ค่านี้อัตโนมัติครับ`,
            search: "Default Gateway",
          };
        }
        return { text: "Workspace นี้ยังไม่มี Router ที่ตั้ง IP ไว้ครับ เพิ่ม Router และตั้ง IP (เช่น 192.168.1.1) ก่อน แล้วใช้ IP นั้นเป็น Default Gateway", search: "Default Gateway" };
      }

      if (wantsProblems || wantsPing) {
        if (!analysis.issues.length) {
          return { text: `ไม่พบปัญหาใน “${workspace.name}” ครับ ✓\nมี ${analysis.stats.devices} อุปกรณ์ · ${analysis.stats.workingLinks}/${analysis.stats.links} การเชื่อมต่อใช้งานได้\nลองถามเช่น “PC-01 ping Router ได้ไหม” เพื่อทดสอบเส้นทาง` };
        }
        flash(workspace, [...new Set(analysis.issues.flatMap((i) => i.deviceIds))]);
        return { text: `พบ ${analysis.issues.length} ปัญหาใน “${workspace.name}”:\n${issueLines(analysis.issues)}\nไม่แน่ใจว่าแก้ยังไง พิมพ์ “ขอคำใบ้” ได้ครับ` };
      }
    }
    if (!workspace && (wantsFix || wantsPing || wantsProblems)) {
      return { text: "ตอนนี้ยังไม่มี Workspace ที่เปิดอยู่ครับ เปิด Workspace หรือเริ่มภารกิจก่อน แล้วผมจะตรวจอุปกรณ์และการเชื่อมต่อให้ทันที" };
    }
    if (/มี.*กี่|จำนวน|สรุป.*workspace|แผนผัง/.test(lower) && workspace) {
      const types = [...new Set(workspace.nodes.map((node) => node.type))]
        .map((type) => `${type} ${workspace.nodes.filter((node) => node.type === type).length}`)
        .join(", ");
      return { text: `Workspace “${workspace.name}” มี ${workspace.nodes.length} อุปกรณ์ (${types || "ยังไม่มีอุปกรณ์"}) และ ${workspace.links.length} การเชื่อมต่อครับ` };
    }
    if (/ต่อ.*(lan|สาย)|เชื่อมสาย|พอร์ต/.test(lower)) return { text: "ลากอุปกรณ์มาวาง จากนั้นลากพอร์ตสีฟ้าของเครื่องหนึ่งไปยังอีกเครื่อง หรือเลือกเครื่องมือ “เชื่อมสาย LAN” โครงสร้างห้องเรียนที่แนะนำคือ Computer/Server → Switch → Router ครับ", search: "LAN Switch Router" };
    if (/ต่อ.*wi.?fi|เชื่อม.*wi.?fi|ssid|รหัสผ่าน.*wi.?fi/.test(lower)) return { text: "ต่อสาย Access Point เข้ากับ Switch ก่อน แล้วเลือก “เชื่อม Wi-Fi” คลิก Access Point ตามด้วย Notebook จากนั้นตรวจว่า SSID และรหัสผ่านของทั้งสองฝั่งตรงกันครับ", search: "Wi-Fi SSID Access Point" };
    if (/ส่ง.*(packet|แพ็ก)|packet.*ยังไง/.test(lower)) return { text: "เลือกเครื่องมือ “ส่งแพ็กเก็ต” แล้วคลิกอุปกรณ์ต้นทางและปลายทาง ระบบจะแสดงเส้นทางและแต่ละ hop ถ้าส่งไม่ถึง ให้ตรวจ IP, สาย และ Gateway ตามลำดับครับ", search: "Packet Ping Traceroute" };
    if (/ภารกิจ|mission/.test(lower)) return { text: "เปิด Mission Control จาก Dock อ่านบทเรียนของภารกิจก่อน แล้วเริ่มภารกิจ เมื่อจัดเครือข่ายเสร็จให้กด “ตรวจภารกิจ” หากติดจุดไหนถามผมว่า “ตรวจปัญหา” ได้เลยครับ" };
    const found = window.NetKnowledge?.search(query)?.[0];
    if (found) return { text: `${found.title}: ${found.summary}`, search: query };
    return { text: "ผมยังจับหัวข้อจากคำถามนี้ได้ไม่ชัดครับ ลองระบุคำสำคัญ เช่น Router, IP, Gateway, Wi-Fi, DHCP, DNS, Ping หรือขอให้ผม “ตรวจปัญหา” ใน Workspace ได้เลย", search: query };
  }

  // The workspace the learner is looking at right now (it may change while Navi stays open).
  const currentWorkspace = (fallback) => (typeof active !== "undefined" ? active : fallback);

  function open(workspace, user) {
    const hintState = { key: null, level: 0 };
    let busy = false;
    const app = window.DesktopWindows.open({
      id: "navi",
      title: "Navi — Network Navigator",
      icon: "navi",
      width: 720,
      height: 590,
      content: `<div class="navi"><header class="navi-head"><div class="navi-orb"><div class="assistant-face"></div><i></i></div><div><small>NETWORK NAVIGATOR</small><h2>Navi</h2><p>${workspace ? `กำลังดูแล “${escapeHtml(workspace.name)}”` : "ผู้ช่วยเรียนรู้และแก้ปัญหาเครือข่าย"}</p></div><span class="navi-online">พร้อมช่วย</span></header><div class="navi-chat" id="naviChat" aria-live="polite"></div><section class="navi-compose"><div class="navi-suggestion-label">คำถามแนะนำ</div><div class="navi-suggestions"><button data-navi-q="Workspace นี้มีปัญหาอะไรบ้าง">ตรวจ Workspace</button><button data-navi-q="ขอคำใบ้">ขอคำใบ้</button><button data-navi-q="Navi ทำอะไรได้บ้าง">ถามอะไรได้บ้าง</button><button data-navi-q="อธิบาย DHCP ให้หน่อย">DHCP คืออะไร</button></div><form class="navi-input" id="naviForm"><span class="navi-input-icon" aria-hidden="true">⌕</span><label class="sr-only" for="naviQuestion">ถาม Navi เรื่องเครือข่าย</label><input id="naviQuestion" placeholder="ถาม Navi เรื่องเครือข่าย…" autocomplete="off"><button class="navi-send" type="submit"><span>ถาม Navi</span><i aria-hidden="true">↑</i></button></form></section><footer class="navi-footer"><span>คำตอบอิงจากบทเรียนและ Workspace ปัจจุบัน</span><button id="naviKnowledge">เปิด Net Encyclopedia</button></footer></div>`,
    });
    app.workspace = workspace;
    app.user = user;
    if (app.initialized) {
      const context = app.body.querySelector(".navi-head p");
      if (context) context.textContent = workspace ? `กำลังดูแล “${workspace.name}”` : "ผู้ช่วยเรียนรู้และแก้ปัญหาเครือข่าย";
      app.body.querySelector("#naviQuestion")?.focus();
      return;
    }

    app.initialized = true;
    const root = app.body;
    const chat = root.querySelector("#naviChat"), input = root.querySelector("#naviQuestion"), send = root.querySelector(".navi-send");
    const addMessage = (role, text, search) => {
      conversation.push({ role, text });
      if (conversation.length > 50) conversation.shift();
      const row = document.createElement("div");
      // "from-navi", not "navi": .navi is the whole window's layout class and would stretch every bubble.
      row.className = `navi-message ${role === "navi" ? "from-navi" : role}`;
      const bubble = document.createElement("div");
      bubble.textContent = text;
      row.appendChild(bubble);
      if (search) {
        const source = document.createElement("button");
        source.className = "navi-source";
        source.textContent = "อ่านเพิ่มเติมใน Net Encyclopedia ↗";
        source.onclick = () => window.NetKnowledge?.open(search);
        row.appendChild(source);
      }
      chat.appendChild(row);
      chat.scrollTop = chat.scrollHeight;
    };
    const ask = async (question) => {
      if (busy || !question.trim()) return;
      busy = true;
      send.disabled = true;
      addMessage("user", question.trim());
      input.value = "";
      const thinking = document.createElement("div");
      thinking.className = "navi-message from-navi thinking";
      thinking.innerHTML = "<div><i></i><i></i><i></i></div>";
      chat.appendChild(thinking);
      chat.scrollTop = chat.scrollHeight;
      let response;
      app.workspace = currentWorkspace(app.workspace);
      const context = root.querySelector(".navi-head p");
      if (context) context.textContent = app.workspace ? `กำลังดูแล “${app.workspace.name}”` : "ผู้ช่วยเรียนรู้และแก้ปัญหาเครือข่าย";
      try {
        response = await answer(app.workspace, app.user, question, hintState);
      } catch (error) {
        response = { text: error?.message || "เกิดข้อผิดพลาดชั่วคราว ลองถามใหม่อีกครั้งครับ" };
      }
      thinking.remove();
      addMessage("navi", response.text, response.search);
      busy = false;
      send.disabled = false;
      input.focus();
    };

    addMessage("navi", `สวัสดีครับ ${user?.name || ""} ผม Navi ผมตอบคำถามเรื่องเครือข่ายและช่วยตรวจ Workspace ให้ได้ ลองถามผมได้เลยครับ`);
    root.querySelector("#naviForm").onsubmit = (event) => { event.preventDefault(); ask(input.value); };
    root.querySelectorAll("[data-navi-q]").forEach((button) => button.onclick = () => ask(button.dataset.naviQ));
    root.querySelector("#naviKnowledge").onclick = () => window.NetKnowledge?.open();
    input.focus();
  }

  window.NaviAssistant = { open };
})();
