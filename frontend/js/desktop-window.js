// Reusable Yosemite-style desktop windows for apps outside the Workspace editor.
// Public API: DesktopWindows.open(options), DesktopWindows.renderMinimized(area).
(() => {
  const apps = [];
  let fallbackZ = 60;
  const escapeHtml = (value) => String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
  const nextZ = () => window.nextDesktopZ?.() || ++fallbackZ;
  const syncDock = () => window.syncMinimizedDock?.();

  function focus(app) {
    if (!app?.el?.isConnected) return;
    app.el.style.zIndex = nextZ();
  }

  function open({ id, title, icon = "app", width = 860, height = 610, content = "" }) {
    const existing = apps.find((app) => app.id === id && app.el.isConnected);
    if (existing) {
      existing.minimized = false;
      existing.el.classList.remove("minimized");
      focus(existing);
      return existing;
    }

    const layer = document.querySelector("#windowLayer");
    const offset = (apps.length % 4) * 24;
    const el = document.createElement("section");
    el.className = `desktop-app-window ${id}-window`;
    el.dataset.appId = id;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${Math.max(12, 92 + offset)}px`;
    el.style.top = `${Math.max(12, 38 + offset)}px`;
    const kind = icon === "browser" ? "KNOWLEDGE" : icon === "navi" ? "ASSISTANT" : "APPLICATION";
    el.innerHTML = `<header class="titlebar"><div class="traffic"><button class="close" aria-label="ปิดหน้าต่าง"></button><button class="min" aria-label="ย่อหน้าต่างลง Dock"></button><button class="max" aria-label="ขยายหรือคืนขนาดหน้าต่าง"></button></div><div class="window-title">${escapeHtml(title)}</div><div class="window-state"><span class="app-window-kind">${kind}</span></div></header><div class="desktop-app-body">${content}</div>`;
    layer.appendChild(el);

    const app = { id, title, icon, el, body: el.querySelector(".desktop-app-body"), minimized: false };
    apps.push(app);
    app.close = () => {
      el.remove();
      apps.splice(apps.indexOf(app), 1);
      syncDock();
    };

    el.querySelector(".close").onclick = app.close;
    el.querySelector(".min").onclick = () => {
      app.minimized = true;
      el.classList.add("minimized");
      syncDock();
    };
    el.querySelector(".max").onclick = () => el.classList.toggle("maximized");
    el.addEventListener("pointerdown", () => focus(app));

    const bar = el.querySelector(".titlebar");
    let moving = false, offsetX = 0, offsetY = 0;
    bar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      moving = true;
      const rect = el.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!moving || el.classList.contains("maximized")) return;
      const rect = layer.getBoundingClientRect();
      el.style.left = Math.max(0, Math.min(rect.width - el.offsetWidth, event.clientX - rect.left - offsetX)) + "px";
      el.style.top = Math.max(0, Math.min(rect.height - el.offsetHeight, event.clientY - rect.top - offsetY)) + "px";
    });
    bar.addEventListener("pointerup", () => (moving = false));
    focus(app);
    return app;
  }

  function renderMinimized(area) {
    apps.filter((app) => app.minimized).forEach((app) => {
      const button = document.createElement("button");
      button.className = "minimized-app desktop-app-minimized";
      button.dataset.appIcon = app.icon || "app";
      button.title = app.title;
      button.setAttribute("aria-label", `คืนหน้าต่าง ${app.title}`);
      button.onclick = () => {
        app.minimized = false;
        app.el.classList.remove("minimized");
        focus(app);
        syncDock();
      };
      area.appendChild(button);
    });
  }

  window.DesktopWindows = { open, renderMinimized };
})();
