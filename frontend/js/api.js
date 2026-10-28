// Talks to the CAI Net backend. Every call returns parsed JSON or throws an Error with a Thai message.
const api = (() => {
  async function request(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจว่าเปิด backend อยู่ (npm start)");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      err.status = res.status;
      if (res.status === 401 && typeof window.onSessionExpired === "function") window.onSessionExpired();
      throw err;
    }
    return data;
  }
  const get = (url) => request("GET", url);
  const post = (url, body = {}) => request("POST", url, body);
  const put = (url, body) => request("PUT", url, body);
  const del = (url) => request("DELETE", url);

  return {
    me: () => get("/api/me"),
    loginStudent: (studentId, name) => post("/api/auth/student", { studentId, name }),
    logout: () => post("/api/auth/logout"),
    progress: () => get("/api/progress"),

    listWorkspaces: () => get("/api/workspaces"),
    getWorkspace: (id) => get(`/api/workspaces/${id}`),
    createWorkspace: (name, data, missionId) => post("/api/workspaces", { name, data, missionId }),
    updateWorkspace: (id, name, data) => put(`/api/workspaces/${id}`, { name, data }),
    deleteWorkspace: (id) => del(`/api/workspaces/${id}`),

    analyze: (workspace) => post("/api/engine/analyze", { workspace }),
    ping: (workspace, from, to, count) => post("/api/engine/ping", { workspace, from, to, count }),
    traceroute: (workspace, from, to) => post("/api/engine/traceroute", { workspace, from, to }),
    exec: (workspace, device, command) => post("/api/engine/exec", { workspace, device, command }),
    hint: (workspace, level, attemptId) => post("/api/assistant/hint", { workspace, level, attemptId }),

    lessons: () => get("/api/lessons"),
    lesson: (id) => get(`/api/lessons/${id}`),
    markLessonRead: (id) => post(`/api/lessons/${id}/read`),

    missions: () => get("/api/missions"),
    startMission: (id) => post(`/api/missions/${id}/start`),
    checkMission: (id, attemptId, workspace) => post(`/api/missions/${id}/check`, { attemptId, workspace }),

    quiz: (id) => get(`/api/quizzes/${id}`),
    submitQuiz: (id, answers, seconds) => post(`/api/quizzes/${id}/submit`, { answers, seconds }),
    survey: () => get("/api/survey"),
    submitSurvey: (answers, comment) => post("/api/survey", { answers, comment }),
  };
})();
