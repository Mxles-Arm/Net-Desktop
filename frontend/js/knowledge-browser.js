// Net Encyclopedia: searchable local knowledge plus lesson content from the backend.
(() => {
  const escapeHtml = (value) => String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
  const CORE_ARTICLES = [
    { id: "router", category: "อุปกรณ์", icon: "◉", title: "Router", tags: "เราเตอร์ gateway dhcp routing", summary: "เชื่อมต่อคนละเครือข่าย กำหนดเส้นทาง และมักทำหน้าที่เป็น Default Gateway", body: `<p>Router หรือเราเตอร์ทำหน้าที่ส่งข้อมูลระหว่างเครือข่าย เช่น จาก LAN ในห้องเรียนไปยังเครือข่ายอื่น เครื่องปลายทางจึงต้องตั้ง <b>Default Gateway</b> เป็น IP ของ Router ที่อยู่ในวงเดียวกัน</p><h3>หน้าที่ใน Net Desktop</h3><ul><li>เชื่อมวงเครือข่ายเข้าหากัน</li><li>แจก IP อัตโนมัติเมื่อเปิด DHCP Server</li><li>ทำหน้าที่เป็น Gateway และ DNS จำลอง</li></ul>` },
    { id: "switch", category: "อุปกรณ์", icon: "▤", title: "Switch", tags: "สวิตช์ lan mac address cable", summary: "จุดรวมสาย LAN ที่ส่งเฟรมไปยังพอร์ตของอุปกรณ์ปลายทาง", body: `<p>Switch เชื่อมอุปกรณ์ภายใน LAN เดียวกันและเรียนรู้ว่า MAC Address ใดอยู่พอร์ตใด จึงส่งเฟรมไปยังปลายทางได้ตรงกว่าการกระจายทุกพอร์ต</p><p>ในแผนผังห้องเรียนควรต่อ Computer, Server และ Access Point เข้ากับ Switch แล้วต่อ Switch ไปยัง Router</p>` },
    { id: "computer", category: "อุปกรณ์", icon: "▣", title: "Computer และ Notebook", tags: "pc laptop notebook client เครื่องลูกข่าย", summary: "เครื่องปลายทางสำหรับทดลอง IP, Wi-Fi, DNS และการส่งแพ็กเก็ต", body: `<p>Computer และ Notebook เป็นเครื่องลูกข่าย ทั้งคู่ใช้ Static IP หรือ DHCP ได้ แต่ Notebook รองรับ Wi-Fi เพิ่มเติม ส่วน Computer ในแบบจำลองนี้ใช้สาย LAN</p><p>ใช้ Terminal ตรวจค่าด้วย <code>ipconfig /all</code> และทดสอบปลายทางด้วย <code>ping</code></p>` },
    { id: "server", category: "อุปกรณ์", icon: "▥", title: "Server", tags: "เซิร์ฟเวอร์ service static ip dns file web", summary: "เครื่องให้บริการที่ควรใช้ Static IP เพื่อให้เครื่องลูกข่ายหาเจอเสมอ", body: `<p>Server ให้บริการข้อมูล เว็บไซต์ หรือไฟล์แก่เครื่องอื่น IP ของ Server จึงควรคงที่และไม่ซ้ำกับอุปกรณ์อื่น</p><p>ใน Net Desktop ชื่ออุปกรณ์จะถูกใช้เป็นชื่อ DNS เช่น <b>File Server</b> จะค้นหาได้ด้วย <code>file-server</code></p>` },
    { id: "access-point", category: "อุปกรณ์", icon: "◔", title: "Access Point", tags: "ap wifi ssid wireless password", summary: "กระจาย Wi-Fi และเชื่อมอุปกรณ์ไร้สายเข้ากับ LAN แบบสาย", body: `<p>Access Point (AP) เป็นสะพานระหว่าง Wi-Fi กับ LAN จึงควรต่อสาย AP เข้ากับ Switch หรือ Router</p><p>เครื่องลูกข่ายต้องใช้ SSID และรหัสผ่านตรงกับ AP จึงจะสื่อสารผ่านเครือข่ายได้</p>` },
    { id: "lan-wifi", category: "การเชื่อมต่อ", icon: "⌁", title: "LAN และ Wi-Fi", tags: "สาย lan wifi wireless ssid topology", summary: "LAN ใช้สาย ส่วน Wi-Fi ใช้คลื่นวิทยุ ทั้งสองแบบอยู่ในเครือข่ายเดียวกันได้", body: `<p>LAN เหมาะกับการเชื่อมต่อที่เสถียรและรวดเร็ว ส่วน Wi-Fi เพิ่มความคล่องตัว ใน Net Desktop เส้นทึบสีฟ้าคือสาย LAN และเส้นประสีม่วงคือ Wi-Fi</p><p>Access Point ทำให้เครื่องไร้สายสื่อสารกับอุปกรณ์ฝั่งสายได้</p>` },
    { id: "ip-address", category: "พื้นฐานเครือข่าย", icon: "#", title: "IP Address และ Subnet Mask", tags: "ip subnet mask 255.255.255.0 conflict private", summary: "ที่อยู่ของอุปกรณ์และกติกาที่ระบุว่าเครื่องใดอยู่ในวงเครือข่ายเดียวกัน", body: `<p>IPv4 มีตัวเลข 4 ชุด เช่น <code>192.168.1.20</code> แต่ละเครื่องต้องมี IP ไม่ซ้ำกัน มิฉะนั้นจะเกิด IP Conflict</p><p>Subnet Mask <code>255.255.255.0</code> หรือ /24 หมายถึงสามชุดแรกเป็นส่วนเครือข่าย เครื่อง 192.168.1.x จึงอยู่ในวงเดียวกัน</p>` },
    { id: "gateway", category: "พื้นฐานเครือข่าย", icon: "⇥", title: "Default Gateway", tags: "gateway เกตเวย์ router route ต่างวง", summary: "ประตูที่เครื่องใช้ส่งข้อมูลออกไปยังเครือข่ายอื่น", body: `<p>ถ้าปลายทางอยู่นอกวง เครื่องจะส่งแพ็กเก็ตไปยัง Default Gateway ซึ่งควรเป็น IP ของ Router ในวงเดียวกับเครื่อง</p><p>ตัวอย่าง: เครื่อง <code>192.168.1.20/24</code> ใช้ Gateway <code>192.168.1.1</code></p>` },
    { id: "dhcp", category: "บริการเครือข่าย", icon: "D", title: "DHCP และ APIPA", tags: "dhcp dora automatic ip apipa 169.254", summary: "แจก IP, Mask, Gateway และ DNS ให้เครื่องลูกข่ายโดยอัตโนมัติ", body: `<p>DHCP ใช้กระบวนการ DORA: Discover → Offer → Request → Acknowledge ถ้าหา DHCP Server ไม่พบ เครื่องอาจได้ APIPA <code>169.254.x.x</code> และติดต่อ Router ไม่ได้</p>` },
    { id: "dns", category: "บริการเครือข่าย", icon: "A", title: "DNS", tags: "dns domain name nslookup hostname ชื่อเครื่อง", summary: "แปลงชื่อที่มนุษย์จำง่ายให้เป็น IP Address", body: `<p>DNS เปรียบเหมือนสมุดโทรศัพท์ของเครือข่าย ใช้ <code>nslookup ชื่อเครื่อง</code> เพื่อตรวจว่าชื่อถูกแปลงเป็น IP ใด</p>` },
    { id: "packet", category: "การทดสอบ", icon: "✉", title: "Packet, Ping และ Traceroute", tags: "packet ping traceroute hop ทดสอบ ส่งแพ็กเก็ต", summary: "เครื่องมือสำหรับดูว่าข้อมูลเดินทางถึงปลายทางหรือหยุดที่จุดใด", body: `<p>Packet คือหน่วยข้อมูลที่เดินทางในเครือข่าย <code>ping</code> ทดสอบว่าปลายทางตอบกลับหรือไม่ ส่วน <code>tracert</code> แสดงแต่ละ hop ที่แพ็กเก็ตผ่าน</p><p>ใน Workspace เลือก <b>ส่งแพ็กเก็ต</b> แล้วคลิกต้นทางและปลายทางเพื่อดูเส้นทางแบบภาพ</p>` },
  ];

  let articles = [...CORE_ARTICLES];
  const searchableText = (article) => `${article.title} ${article.tags || ""} ${article.summary || ""} ${(article.body || "").replace(/<[^>]+>/g, " ")}`.toLowerCase();
  function search(query, category = "ทั้งหมด") {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return articles
      .filter((article) => category === "ทั้งหมด" || article.category === category)
      .map((article) => {
        const text = searchableText(article);
        const score = words.reduce((total, word) => total + (article.title.toLowerCase().includes(word) ? 5 : text.includes(word) ? 1 : 0), 0);
        return { ...article, score };
      })
      .filter((article) => !words.length || article.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "th"));
  }

  async function loadLessons() {
    try {
      const lessons = await Promise.race([
        api.lessons().then((list) => Promise.all(list.lessons.map((item) => api.lesson(item.id)))),
        new Promise((_, reject) => setTimeout(() => reject(new Error("knowledge timeout")), 4500)),
      ]);
      const lessonArticles = lessons.map(({ lesson }) => ({
        id: `lesson-${lesson.id}`,
        category: "บทเรียน",
        icon: String(lesson.order),
        title: `บทที่ ${lesson.order}: ${lesson.title}`,
        tags: `${lesson.goal} ${lesson.sections.flatMap((section) => [section.h, ...(section.p || []), ...(section.list || [])]).join(" ")}`,
        summary: lesson.goal,
        body: lesson.sections.map((section) => `<section class="kb-section"><h3>${escapeHtml(section.h)}</h3>${(section.p || []).map((text) => `<p>${escapeHtml(text)}</p>`).join("")}${section.list ? `<ul>${section.list.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}${section.code ? `<pre>${escapeHtml(section.code.join("\n"))}</pre>` : ""}${section.tip ? `<div class="kb-tip">💡 ${escapeHtml(section.tip)}</div>` : ""}</section>`).join(""),
      }));
      articles = [...CORE_ARTICLES, ...lessonArticles];
    } catch {
      articles = [...CORE_ARTICLES];
    }
  }

  function open(initialQuery = "") {
    const app = window.DesktopWindows.open({
      id: "knowledge-browser",
      title: "Net Encyclopedia — Knowledge Browser",
      icon: "browser",
      width: 900,
      height: 640,
      content: `<div class="net-browser"><div class="browser-toolbar"><div class="browser-nav"><button id="kbBack" aria-label="ย้อนกลับ" disabled>‹</button><button id="kbHome" aria-label="หน้าแรก">⌂</button></div><div class="browser-address"><span>🔒</span><span id="kbAddress">net://knowledge/home</span></div><button id="kbReload" aria-label="โหลดเนื้อหาใหม่">↻</button></div><form class="browser-search" id="kbSearchForm"><span>⌕</span><input id="kbSearch" value="${escapeHtml(initialQuery)}" placeholder="ค้นหาอุปกรณ์, IP, Wi-Fi, DHCP, DNS…" autocomplete="off"><button>ค้นหา</button></form><div class="browser-content"><aside class="browser-sidebar"><strong>คลังความรู้</strong><button class="on" data-kb-category="ทั้งหมด">ทั้งหมด</button><button data-kb-category="อุปกรณ์">อุปกรณ์</button><button data-kb-category="พื้นฐานเครือข่าย">พื้นฐาน</button><button data-kb-category="บริการเครือข่าย">บริการ</button><button data-kb-category="การเชื่อมต่อ">การเชื่อมต่อ</button><button data-kb-category="การทดสอบ">การทดสอบ</button><button data-kb-category="บทเรียน">บทเรียน</button></aside><main class="browser-page" id="kbPage"></main></div><div class="browser-status"><span id="kbStatus">Net Desktop Knowledge Base</span><span>Local Content</span></div></div>`,
    });
    if (app.initialized) {
      const input = app.body.querySelector("#kbSearch");
      if (initialQuery && input) {
        input.value = initialQuery;
        app.body.querySelector("#kbSearchForm")?.requestSubmit();
      }
      input?.focus();
      return;
    }

    app.initialized = true;
    const root = app.body;
    const page = root.querySelector("#kbPage"), address = root.querySelector("#kbAddress"), status = root.querySelector("#kbStatus"), input = root.querySelector("#kbSearch");
    let category = "ทั้งหมด", history = [], current = null, view = "loading";
    const renderHome = () => {
      current = null;
      view = "home";
      address.textContent = "net://knowledge/home";
      page.innerHTML = `<div class="kb-hero"><span class="kb-compass">◎</span><div><small>NET DESKTOP KNOWLEDGE BASE</small><h2>ค้นหาและเรียนรู้เรื่องเครือข่าย</h2><p>รวมเนื้อหาจากอุปกรณ์ บทเรียน และเครื่องมือภายในระบบ</p></div></div><h3 class="kb-heading">หัวข้อแนะนำ</h3><div class="kb-grid">${CORE_ARTICLES.slice(0, 6).map((article) => `<button class="kb-card" data-kb-id="${article.id}"><span>${article.icon}</span><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.summary)}</small></button>`).join("")}</div>`;
      status.textContent = `${articles.length} บทความพร้อมค้นหา`;
      root.querySelector("#kbBack").disabled = !history.length;
    };
    const renderArticle = (id, remember = true) => {
      const article = articles.find((item) => item.id === id);
      if (!article) return;
      if (remember && view !== "loading") history.push(current ? `article:${current}` : view);
      current = id;
      view = "article";
      address.textContent = `net://knowledge/${article.id}`;
      page.innerHTML = `<article class="kb-article"><div class="kb-article-head"><span>${article.icon}</span><div><small>${escapeHtml(article.category)}</small><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary)}</p></div></div><div class="kb-article-body">${article.body}</div></article>`;
      status.textContent = article.category;
      root.querySelector("#kbBack").disabled = !history.length;
      page.scrollTop = 0;
    };
    const renderResults = () => {
      current = null;
      view = "search";
      const query = input.value.trim(), results = search(query, category);
      address.textContent = `net://search?q=${encodeURIComponent(query || category)}`;
      page.innerHTML = `<div class="kb-results-head"><div><small>ผลการค้นหา</small><h2>${query ? `“${escapeHtml(query)}”` : escapeHtml(category)}</h2></div><strong>${results.length} รายการ</strong></div><div class="kb-results">${results.length ? results.map((article) => `<button data-kb-id="${article.id}"><span class="kb-result-icon">${article.icon}</span><span><small>${escapeHtml(article.category)}</small><b>${escapeHtml(article.title)}</b><em>${escapeHtml(article.summary)}</em></span><i>›</i></button>`).join("") : `<div class="kb-empty"><b>ไม่พบเนื้อหาที่ตรงกัน</b><span>ลองใช้คำว่า IP, Router, Wi-Fi, DHCP, DNS หรือ Packet</span></div>`}</div>`;
      status.textContent = `พบ ${results.length} รายการ`;
      root.querySelector("#kbBack").disabled = !history.length;
    };

    page.addEventListener("click", (event) => {
      const item = event.target.closest("[data-kb-id]");
      if (item) renderArticle(item.dataset.kbId);
    });
    root.querySelector("#kbSearchForm").onsubmit = (event) => { event.preventDefault(); renderResults(); };
    root.querySelector("#kbHome").onclick = renderHome;
    root.querySelector("#kbBack").onclick = () => {
      const previous = history.pop();
      if (previous === "home") renderHome();
      else if (previous === "search") renderResults();
      else if (previous?.startsWith("article:")) renderArticle(previous.slice(8), false);
    };
    root.querySelector("#kbReload").onclick = async () => {
      status.textContent = "กำลังอัปเดตคลังความรู้…";
      await loadLessons();
      input.value.trim() ? renderResults() : renderHome();
    };
    root.querySelectorAll("[data-kb-category]").forEach((button) => button.onclick = () => {
      category = button.dataset.kbCategory;
      root.querySelectorAll("[data-kb-category]").forEach((item) => item.classList.toggle("on", item === button));
      renderResults();
    });
    initialQuery ? renderResults() : renderHome();
    input.focus();
    loadLessons().then(() => {
      if (!app.el.isConnected) return;
      status.textContent = `${articles.length} บทความพร้อมค้นหา`;
      if (view === "search") renderResults();
    });
  }

  window.NetKnowledge = { open, search };
  window.showEncyclopedia = open;
  window.searchNetKnowledge = search;
})();
