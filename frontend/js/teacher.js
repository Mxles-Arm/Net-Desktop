// Teacher dashboard: login, per-student results, E1/E2, survey statistics, common mistakes.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const show = (v) => (v == null ? '<td class="muted">–</td>' : `<td>${esc(v)}</td>`);
  const MEDAL = (s) => (s == null ? "" : s >= 90 ? "🥇" : s >= 75 ? "🥈" : "🥉");

  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return data;
  }

  function showLogin(msg) {
    $("#loginCard").hidden = false;
    $("#report").hidden = true;
    $("#barActions").hidden = true;
    $("#loginError").textContent = msg || "";
    $("#tPass").focus();
  }

  async function load() {
    try {
      const data = await call("GET", "/api/teacher/summary");
      $("#loginCard").hidden = true;
      $("#report").hidden = false;
      $("#barActions").hidden = false;
      render(data);
    } catch (e) {
      showLogin(e.status === 401 || e.status === 403 ? "" : e.message);
    }
  }

  function kpi(value, label, cls = "") {
    return `<div class="kpi ${cls}"><b>${value ?? "–"}</b><span>${label}</span></div>`;
  }

  function render(d) {
    const t = d.totals;
    const pass80 = (v) => (v == null ? "" : v >= 80 ? "ok" : "low");
    $("#kpis").innerHTML =
      kpi(t.students, "ผู้เรียนทั้งหมด") +
      kpi(t.pretestMean != null ? `${t.pretestMean}%` : null, `ก่อนเรียน (เฉลี่ย, n=${t.pretestN})`) +
      kpi(t.posttestMean != null ? `${t.posttestMean}%` : null, `หลังเรียน (เฉลี่ย, n=${t.posttestN})`) +
      kpi(t.E1, `E1 — ระหว่างเรียน (n=${t.e1N})`, pass80(t.E1)) +
      kpi(t.E2, `E2 — หลังเรียน (n=${t.posttestN})`, pass80(t.E2)) +
      kpi(d.survey.overallMean, `ความพึงพอใจ (${d.survey.overallLevel})`);

    const ms = d.missions;
    $("#studentTable").innerHTML = d.students.length
      ? `<thead><tr><th>รหัส</th><th class="left">ชื่อ</th><th>ก่อนเรียน</th><th>หลังเรียน</th><th>พัฒนาการ</th>${ms.map((m, i) => `<th title="${esc(m.title)}">ภารกิจ ${i + 1}</th>`).join("")}<th>ระหว่างเรียน</th><th>คำใบ้</th><th>เวลา (นาที)</th><th>ประเมิน</th><th></th></tr></thead><tbody>${d.students
          .map(
            (s) =>
              `<tr><td>${esc(s.studentId)}</td><td class="left">${esc(s.name)}</td>${show(s.pretest)}${show(s.posttest)}${show(s.gain != null ? (s.gain > 0 ? "+" : "") + s.gain : null)}${ms
                .map((m) => (s.missions[m.id] == null ? '<td class="muted">–</td>' : `<td>${MEDAL(s.missions[m.id])} ${s.missions[m.id]}</td>`))
                .join("")}${show(s.exercise)}<td>${s.hints}</td>${show(s.minutes)}<td>${s.survey ? "✓" : "–"}</td><td><button data-del="${s.id}" data-name="${esc(s.name)}">ลบ</button></td></tr>`,
          )
          .join("")}</tbody>`
      : '<tbody><tr><td class="empty">ยังไม่มีผู้เรียนเข้าสู่ระบบ</td></tr></tbody>';
    $("#studentNote").textContent = "คะแนนก่อนเรียนใช้ครั้งแรก คะแนนหลังเรียนใช้ครั้งล่าสุด คะแนนภารกิจใช้ครั้งที่ดีที่สุด (ร้อยละ)";
    document.querySelectorAll("[data-del]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm(`ลบข้อมูลทั้งหมดของ "${b.dataset.name}"? (ย้อนกลับไม่ได้)`)) return;
          try {
            await call("DELETE", `/api/teacher/students/${b.dataset.del}`);
            load();
          } catch (e) {
            alert(e.message);
          }
        }),
    );

    const sv = d.survey;
    $("#surveyTable").innerHTML = `<thead><tr><th class="left">รายการ (n=${sv.n})</th><th>x̄</th><th>S.D.</th><th>ระดับ</th></tr></thead><tbody>${sv.items
      .map((it, i) => `<tr><td class="left">${i + 1}. ${esc(it.text)}</td>${show(it.mean)}${show(it.sd)}<td>${esc(it.level)}</td></tr>`)
      .join("")}<tr><th class="left">รวม</th>${show(sv.overallMean)}${show(sv.overallSd)}<th>${esc(sv.overallLevel)}</th></tr></tbody>`;
    $("#comments").innerHTML = sv.comments.length
      ? `<h2 class="mt">ข้อเสนอแนะ</h2>${sv.comments.map((c) => `<div class="comment">${esc(c)}</div>`).join("")}`
      : "";

    const max = Math.max(1, ...d.topMistakes.map((m) => m.count));
    $("#mistakes").innerHTML = d.topMistakes.length
      ? d.topMistakes
          .map((m) => `<div class="bar-row"><span>${esc(m.label)}</span><b>${m.count}</b><div class="track"><div class="fill" style="width:${(m.count / max) * 100}%"></div></div></div>`)
          .join("") + '<p class="note">นับจากการกด "ตรวจภารกิจ" ที่ยังไม่ผ่าน</p>'
      : '<p class="empty">ยังไม่มีข้อมูล</p>';
  }

  // The password is hidden as dots, so warn when the Thai layout or Caps Lock is on.
  const warnKeyboard = (e) => {
    const thai = /[฀-๿]/.test($("#tPass").value);
    const caps = e.getModifierState?.("CapsLock");
    const msg = thai
      ? "⚠ แป้นพิมพ์เป็นภาษาไทยอยู่ — กดปุ่ม ~ หรือ Alt + Shift เพื่อเปลี่ยนเป็น ENG แล้วพิมพ์รหัสใหม่"
      : caps
        ? "⚠ เปิด Caps Lock อยู่ — รหัสผ่านแยกตัวพิมพ์เล็กกับตัวพิมพ์ใหญ่"
        : "";
    $("#kbWarn").textContent = msg;
    $("#kbWarn").hidden = !msg;
  };
  $("#tPass").addEventListener("input", warnKeyboard);
  $("#tPass").addEventListener("keyup", warnKeyboard);

  $("#teacherForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await call("POST", "/api/auth/teacher", { password: $("#tPass").value });
      $("#tPass").value = "";
      load();
    } catch (err) {
      $("#loginError").textContent = err.message;
    }
  };
  $("#refreshBtn").onclick = load;
  $("#logoutBtn").onclick = async () => {
    await call("POST", "/api/auth/logout").catch(() => {});
    showLogin();
  };
  load();
})();
