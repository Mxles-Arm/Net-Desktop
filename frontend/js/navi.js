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

  async function answer(workspace, user, question, hintLevel) {
    const query = question.trim(), lower = query.toLowerCase();
    if (!query) return { text: "ลองพิมพ์สิ่งที่อยากรู้ หรือเลือกคำถามแนะนำด้านล่างได้เลยครับ" };
    if (/สวัสดี|หวัดดี|hello|hi\b/.test(lower)) return { text: `สวัสดีครับ ${user?.name || ""} ผม Navi ผู้ช่วยนำทางเครือข่าย วันนี้อยากตรวจ Workspace หรือเรียนรู้เรื่องไหนครับ` };
    if (/ทำอะไรได้|ช่วยอะไร|ความสามารถ|help/.test(lower)) return { text: "ผมช่วยตรวจปัญหาใน Workspace, ให้คำใบ้ตามภารกิจ, อธิบาย IP/Wi-Fi/DHCP/DNS, แนะนำการต่ออุปกรณ์ และพาไปอ่านรายละเอียดใน Net Encyclopedia ได้ครับ" };
    if (/ตรวจ|วิเคราะห์|ปัญหา|ทำไม.*(ไม่ได้|ไม่ถึง)|เชื่อม.*ไม่ได้|ping.*ไม่ได้|คำใบ้|แก้ยังไง/.test(lower)) {
      if (!workspace) return { text: "ตอนนี้ยังไม่มี Workspace ที่เปิดอยู่ครับ เปิด Workspace หรือเริ่มภารกิจก่อน แล้วผมจะตรวจอุปกรณ์และการเชื่อมต่อให้ทันที" };
      try {
        const level = /ละเอียด|วิธีแก้|บอกวิธี/.test(lower) ? 3 : Math.min(hintLevel, 3);
        const result = await api.hint(workspaceData(workspace), level, workspace.attemptId);
        if (result.highlight.length) flash(workspace, result.highlight);
        return {
          text: result.hasProblem
            ? `${result.text}${result.remaining > 1 ? ` ยังพบอีก ${result.remaining - 1} จุด แนะนำให้แก้ทีละจุดแล้วถามผมใหม่ครับ` : ""}`
            : `${result.text} ตอนนี้ Workspace มี ${workspace.nodes.length} อุปกรณ์ และ ${workspace.links.length} การเชื่อมต่อครับ`,
        };
      } catch (error) {
        return { text: error.message };
      }
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

  function open(workspace, user) {
    let hintLevel = 1, busy = false;
    const app = window.DesktopWindows.open({
      id: "navi",
      title: "Navi — Network Navigator",
      icon: "navi",
      width: 720,
      height: 590,
      content: `<div class="navi"><header class="navi-head"><div class="navi-orb"><div class="assistant-face"></div><i></i></div><div><small>NETWORK NAVIGATOR</small><h2>Navi</h2><p>${workspace ? `กำลังดูแล “${escapeHtml(workspace.name)}”` : "ผู้ช่วยเรียนรู้และแก้ปัญหาเครือข่าย"}</p></div><span class="navi-online">พร้อมช่วย</span></header><div class="navi-chat" id="naviChat" aria-live="polite"></div><section class="navi-compose"><div class="navi-suggestion-label">คำถามแนะนำ</div><div class="navi-suggestions"><button data-navi-q="ตรวจปัญหาใน Workspace นี้">ตรวจ Workspace</button><button data-navi-q="ฉันควรต่อ LAN อย่างไร">วิธีต่อ LAN</button><button data-navi-q="อธิบาย DHCP ให้หน่อย">DHCP คืออะไร</button><button data-navi-q="ส่งแพ็กเก็ตอย่างไร">ส่งแพ็กเก็ต</button></div><form class="navi-input" id="naviForm"><span class="navi-input-icon" aria-hidden="true">⌕</span><label class="sr-only" for="naviQuestion">ถาม Navi เรื่องเครือข่าย</label><input id="naviQuestion" placeholder="ถาม Navi เรื่องเครือข่าย…" autocomplete="off"><button class="navi-send" type="submit"><span>ถาม Navi</span><i aria-hidden="true">↑</i></button></form></section><footer class="navi-footer"><span>คำตอบอิงจากบทเรียนและ Workspace ปัจจุบัน</span><button id="naviKnowledge">เปิด Net Encyclopedia</button></footer></div>`,
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
      row.className = `navi-message ${role}`;
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
      thinking.className = "navi-message navi thinking";
      thinking.innerHTML = "<div><i></i><i></i><i></i></div>";
      chat.appendChild(thinking);
      chat.scrollTop = chat.scrollHeight;
      let response;
      try {
        response = await answer(app.workspace, app.user, question, hintLevel);
      } catch (error) {
        response = { text: error?.message || "เกิดข้อผิดพลาดชั่วคราว ลองถามใหม่อีกครั้งครับ" };
      }
      if (/ตรวจ|ปัญหา|คำใบ้/.test(question)) hintLevel = Math.min(hintLevel + 1, 3);
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
