/* ============================================================
   AW3 — API layer.
   Talks to the backend with cookie auth. If no backend is reachable
   (e.g. opening index.html straight off disk, or a static-only host),
   everything degrades to a local-only "demo" mode so the UI still works.
   window.AW3API.ready resolves to true (online) or false (local).
   ============================================================ */
(function () {
  const CFG = window.AW3_CONFIG || {};
  const BASE = (CFG.API_BASE || "").replace(/\/$/, "");
  const url = (p) => BASE + p;

  let online = false;

  async function request(p, opts = {}) {
    const res = await fetch(url(p), {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Probe the backend once at boot.
  const ready = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch(url("/api/health"), { signal: ctrl.signal, credentials: "include" });
      clearTimeout(t);
      online = r.ok;
    } catch (e) {
      online = false;
    }
    document.dispatchEvent(new CustomEvent("aw3:apiready", { detail: { online } }));
    return online;
  })();

  function discordHref() {
    if (CFG.DISCORD_INVITE) return CFG.DISCORD_INVITE;
    if (CFG.DISCORD_ID) return "https://discord.com/users/" + CFG.DISCORD_ID;
    return "#";
  }

  window.AW3API = {
    ready,
    isOnline: () => online,
    get: (p) => request(p),
    post: (p, body) => request(p, { method: "POST", body: JSON.stringify(body || {}) }),
    del: (p) => request(p, { method: "DELETE" }),
    discordHref,
    config: CFG,
  };
})();
