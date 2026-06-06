/* ============================================================
   Leaderboard — global ranking (gems / star shards).
   Server is the source of truth; scores are validated server-side.
   In demo mode (no backend) it shows this browser's clicker stats only.
   ============================================================ */
(function () {
  const root = document.getElementById("leaderboard-root");
  if (!root) return;

  let mode = "local", metric = "gems", rows = [], loading = true;

  const SUFF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  function fmt(n) {
    if (!isFinite(n)) return "∞";
    if (n < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, "");
    const t = Math.floor(Math.log10(n) / 3), s = SUFF[t] || "e" + t * 3;
    return (n / Math.pow(10, t * 3)).toFixed(2) + s;
  }
  const medal = (r) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");

  root.innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-5 sm:gap-6">
    <aside class="lg:sticky lg:top-20 lg:self-start space-y-4">
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="h-2 w-2 rounded-full bg-amber-400"></span>
          <h3 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Ranking</h3>
        </div>
        <div class="lb-toggle" id="lb-metric">
          <button data-m="gems" class="lb-mbtn active">💎 Gems</button>
          <button data-m="shards" class="lb-mbtn">✦ Star Shards</button>
        </div>
        <div id="lb-you" class="lb-you mt-4"></div>
        <button id="lb-refresh" class="btn-ghost w-full mt-3">Refresh</button>
        <p id="lb-note" class="text-[11px] text-zinc-500 mt-3 leading-relaxed"></p>
      </div>
    </aside>
    <section>
      <div class="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 class="text-lg font-semibold text-zinc-100">Top players</h2>
          <p class="text-xs text-zinc-500">Earn gems in the clicker — your best is submitted automatically.</p>
        </div>
        <span id="lb-count" class="text-xs text-zinc-500"></span>
      </div>
      <div id="lb-list" class="space-y-2"></div>
    </section>
  </div>`;

  const listEl = root.querySelector("#lb-list"),
        youEl = root.querySelector("#lb-you"),
        noteEl = root.querySelector("#lb-note"),
        countEl = root.querySelector("#lb-count");

  root.querySelectorAll("#lb-metric .lb-mbtn").forEach((b) =>
    b.addEventListener("click", () => {
      metric = b.dataset.m;
      root.querySelectorAll("#lb-metric .lb-mbtn").forEach((x) => x.classList.toggle("active", x === b));
      render();
    }));
  root.querySelector("#lb-refresh").addEventListener("click", () => refresh(true));

  function localRows() {
    // demo mode: read this browser's clicker save for the logged-in (or guest) user
    const who = (window.Auth && window.Auth.current()) || "guest";
    try {
      const st = JSON.parse(localStorage.getItem("aw3.clicker." + who) || "{}");
      const gems = st.life || st.total || 0, shards = st.shards || 0, clicks = st.clicks || 0;
      if (!gems && !shards) return [];
      return [{ rank: 1, username: who, gems, shards, clicks }];
    } catch (e) { return [];
    }
  }

  async function refresh(force) {
    loading = true; render();
    if (mode === "server") {
      try { rows = (await window.AW3API.get("/api/leaderboard?metric=" + metric)).rows || []; }
      catch (e) { rows = []; }
    } else {
      rows = localRows();
    }
    loading = false; render();
  }

  function render() {
    const me = (window.Auth && window.Auth.current()) || (mode === "local" ? "guest" : null);
    const key = metric === "shards" ? "shards" : "gems";
    const unit = metric === "shards" ? "✦" : "💎";

    // re-sort client-side so the metric toggle is instant
    const sorted = rows.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).map((r, i) => ({ ...r, rank: i + 1 }));
    countEl.textContent = sorted.length ? `${sorted.length} player${sorted.length > 1 ? "s" : ""}` : "";

    noteEl.textContent = mode === "server"
      ? "Global leaderboard. Scores are validated on the server — impossible jumps are rejected."
      : "Demo mode: no backend connected, so this shows only your own clicker progress in this browser.";

    // "your rank" card
    const mine = me && sorted.find((r) => r.username.toLowerCase() === me.toLowerCase());
    if (me) {
      youEl.innerHTML = mine
        ? `<div class="lb-you-rank">#${mine.rank}</div>
           <div class="lb-you-meta"><span class="lb-you-name">${me}</span>
           <span class="lb-you-val">${unit} ${fmt(mine[key])}</span></div>`
        : `<div class="lb-you-empty">You're not ranked yet — play the clicker to get on the board.</div>`;
    } else {
      youEl.innerHTML = `<button class="acct-login" id="lb-login">Log in to rank</button>`;
      const lg = youEl.querySelector("#lb-login"); if (lg) lg.onclick = () => window.Auth && window.Auth.open("login");
    }

    if (loading) { listEl.innerHTML = `<p class="text-sm text-zinc-600 py-10 text-center">Loading…</p>`; return; }
    if (!sorted.length) {
      listEl.innerHTML = `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-zinc-500">
        No scores yet. Open the <b class="text-zinc-300">Clicker</b> tab and start cracking capsules 💎</div>`;
      return;
    }

    listEl.innerHTML = sorted.map((r) => {
      const isMe = me && r.username.toLowerCase() === me.toLowerCase();
      const m = medal(r.rank);
      return `<div class="lb-row ${r.rank <= 3 ? "top3" : ""} ${isMe ? "me" : ""}">
        <div class="lb-rank">${m || r.rank}</div>
        <div class="lb-ava">${r.username[0].toUpperCase()}</div>
        <div class="lb-name" title="${r.username}">${r.username}${isMe ? '<span class="lb-tag">you</span>' : ""}</div>
        <div class="lb-stats">
          <div class="lb-val">${unit} ${fmt(r[key])}</div>
          <div class="lb-sub">${metric === "shards" ? fmt(r.gems) + " 💎" : (r.shards || 0) + " ✦"}</div>
        </div>
      </div>`;
    }).join("");
  }

  // refresh when the clicker reports a new score, on login change, and on boot
  document.addEventListener("aw3:score", () => { if (mode === "server") refresh(); else render(); });
  window.AW3Leaderboard = { refresh, render };

  (async () => {
    mode = (await window.AW3API.ready) ? "server" : "local";
    if (window.Auth) window.Auth.onChange(() => refresh());
    await refresh();
  })();
})();
