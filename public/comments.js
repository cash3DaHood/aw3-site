/* ============================================================
   Community — tips / team comps / relics board.
   Server-synced when a backend is reachable (shared between everyone),
   localStorage-only as a fallback. Posting & voting require an account.
   ============================================================ */
(function () {
  const root = document.getElementById("community-root");
  if (!root) return;
  const KEY = "aw3.comments.v1";
  const CATS = { tip: { name: "Tip", color: "#34d399" }, comp: { name: "Team Comp", color: "#60a5fa" }, relic: { name: "Relic", color: "#fbbf24" } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let mode = "local";
  let items = [];
  let filter = "all", sort = "new";

  /* ---------- storage backends ---------- */
  const localStore = {
    seed() {
      const now = Date.now(), H = 3600e3;
      return [
        { id: "s1", author: "spliax",  cat: "tip",   text: "Push Secret Chance hard before dumping into luck — luck soft-caps at the 14 − Star breakpoint (×0.05 above it), so raw Secret Chance keeps scaling when luck stops.", ts: now - 26 * H, voters: { xtermiz: 1, akira: 1, momo: 1 } },
        { id: "s2", author: "xtermiz", cat: "comp",  text: "Solid F2P secret-farm comp: Broly (front DPS) + Minato (atk-speed support) + Mihawk (AoE clear). Keep Minato's buff on Broly and let Mihawk wipe waves while you idle opens.", ts: now - 13 * H, voters: { spliax: 1, momo: 1 } },
        { id: "s3", author: "spliax",  cat: "relic", text: "Relic Open Speed is the single biggest grind multiplier in the calc — prioritize it over flat fast-open % once you're past ~100% GP.", ts: now - 5 * H, voters: { xtermiz: 1 } },
        { id: "s4", author: "akira",   cat: "comp",  text: "Naruto (Beast) carries late if you can afford the stars — pair with Vegito for the burst window. Rotate ults on the boss bar.", ts: now - 90 * 60e3, voters: {} },
      ];
    },
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || this.seed(); } catch (e) { return this.seed(); } },
    persist() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} },
  };

  async function refresh() {
    if (mode === "server") {
      try { items = (await window.AW3API.get("/api/comments")).items || []; }
      catch (e) { items = []; }
    } else {
      items = localStore.load(); localStore.persist();
    }
    renderList();
  }

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
    return new Date(ts).toLocaleDateString();
  }

  root.innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-5 sm:gap-6">
    <aside class="lg:sticky lg:top-20 lg:self-start">
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="h-2 w-2 rounded-full bg-indigo-400"></span>
          <h3 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Share with the community</h3>
        </div>
        <label class="text-[13px] font-medium text-zinc-300">Category</label>
        <select id="cm-cat" class="sel-input mt-1.5 mb-3">
          <option value="tip">Tip</option><option value="comp">Team Comp</option><option value="relic">Relic</option>
        </select>
        <label class="text-[13px] font-medium text-zinc-300">Your post</label>
        <textarea id="cm-text" class="cm-textarea mt-1.5" rows="4" maxlength="600" placeholder="Drop a tip, a team comp, or a relic build…"></textarea>
        <div class="flex items-center justify-between mt-2">
          <span id="cm-count" class="text-[11px] text-zinc-600">0 / 600</span>
          <span id="cm-as" class="text-[11px] text-zinc-500"></span>
        </div>
        <button id="cm-post" class="btn-primary w-full mt-3">Post</button>
        <p id="cm-hint" class="text-[11px] text-zinc-500 mt-3"></p>
      </div>
    </aside>
    <section>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
        <div id="cm-filters" class="flex flex-wrap gap-2"></div>
        <select id="cm-sort" class="sel-input !w-auto"><option value="new">Newest</option><option value="top">Top voted</option></select>
      </div>
      <div id="cm-list" class="space-y-3"></div>
    </section>
  </div>`;

  const catEl = root.querySelector("#cm-cat"), textEl = root.querySelector("#cm-text"),
        countEl = root.querySelector("#cm-count"), asEl = root.querySelector("#cm-as"),
        postBtn = root.querySelector("#cm-post"), hintEl = root.querySelector("#cm-hint"),
        filtersEl = root.querySelector("#cm-filters"), sortEl = root.querySelector("#cm-sort"),
        listEl = root.querySelector("#cm-list");

  function renderFilters() {
    const opts = [["all", "All"], ...Object.entries(CATS).map(([id, c]) => [id, c.name])];
    filtersEl.innerHTML = opts.map(([id, name]) =>
      `<button class="cm-chip ${filter === id ? "active" : ""}" data-f="${id}"${id !== "all" ? ` style="--cc:${CATS[id].color}"` : ""}>${name}</button>`).join("");
    filtersEl.querySelectorAll("[data-f]").forEach((b) =>
      b.addEventListener("click", () => { filter = b.dataset.f; renderFilters(); renderList(); }));
  }

  function renderList() {
    const meName = window.Auth && window.Auth.current();
    let rows = items.slice();
    if (filter !== "all") rows = rows.filter((r) => r.cat === filter);
    rows.sort((a, b) => sort === "top"
      ? (Object.keys(b.voters || {}).length - Object.keys(a.voters || {}).length) || (b.ts - a.ts)
      : b.ts - a.ts);
    if (!rows.length) { listEl.innerHTML = `<p class="text-sm text-zinc-600 py-10 text-center">No posts here yet — be the first.</p>`; return; }

    listEl.innerHTML = rows.map((r) => {
      const c = CATS[r.cat] || { name: r.cat, color: "#a1a1aa" };
      const votes = Object.keys(r.voters || {}).length;
      const voted = meName && r.voters && r.voters[meName];
      const mine = meName && meName.toLowerCase() === r.author.toLowerCase();
      return `<article class="cm-card">
        <div class="cm-vote ${voted ? "on" : ""}" data-vote="${r.id}" role="button" tabindex="0" title="Upvote">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5l7 8h-4v6H9v-6H5z"/></svg>
          <span>${votes}</span>
        </div>
        <div class="cm-body">
          <div class="cm-meta">
            <span class="cm-avatar">${esc(r.author[0].toUpperCase())}</span>
            <span class="cm-author">${esc(r.author)}</span>
            <span class="cm-badge" style="--cc:${c.color}">${c.name}</span>
            <span class="cm-time">${timeAgo(r.ts)}</span>
            ${mine ? `<button class="cm-del" data-del="${r.id}" title="Delete">✕</button>` : ""}
          </div>
          <p class="cm-text">${esc(r.text)}</p>
        </div>
      </article>`;
    }).join("");

    listEl.querySelectorAll("[data-vote]").forEach((b) => {
      const fn = () => vote(b.dataset.vote);
      b.addEventListener("click", fn);
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
    });
    listEl.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => del(b.dataset.del)));
  }

  async function vote(id) {
    const meName = window.Auth && window.Auth.current();
    if (!meName) { window.Auth && window.Auth.open("login"); return; }
    if (mode === "server") {
      try {
        const { item } = await window.AW3API.post(`/api/comments/${id}/vote`);
        const i = items.findIndex((x) => x.id === id); if (i >= 0) items[i] = item;
        renderList();
      } catch (e) { if (e.status === 401) window.Auth.open("login"); }
    } else {
      const it = items.find((x) => x.id === id); if (!it) return;
      it.voters = it.voters || {};
      if (it.voters[meName]) delete it.voters[meName]; else it.voters[meName] = 1;
      localStore.persist(); renderList();
    }
  }

  async function del(id) {
    const meName = window.Auth && window.Auth.current();
    const it = items.find((x) => x.id === id);
    if (!it || !meName || meName.toLowerCase() !== it.author.toLowerCase()) return;
    if (!confirm("Delete this post?")) return;
    if (mode === "server") {
      try { await window.AW3API.del(`/api/comments/${id}`); items = items.filter((x) => x.id !== id); renderList(); }
      catch (e) { if (e.status === 401) window.Auth.open("login"); }
    } else {
      items = items.filter((x) => x.id !== id); localStore.persist(); renderList();
    }
  }

  async function post() {
    const meName = window.Auth && window.Auth.current();
    if (!meName) { window.Auth && window.Auth.open("signup"); return; }
    const text = textEl.value.trim();
    if (text.length < 4) { hintEl.textContent = "Write at least a few words."; hintEl.style.color = "#fb7185"; return; }
    postBtn.disabled = true;
    try {
      if (mode === "server") {
        const { item } = await window.AW3API.post("/api/comments", { cat: catEl.value, text });
        items.unshift(item);
      } else {
        items.unshift({ id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: meName, cat: catEl.value, text, ts: Date.now(), voters: {} });
        localStore.persist();
      }
      textEl.value = ""; countEl.textContent = "0 / 600";
      hintEl.textContent = "Posted ✦"; hintEl.style.color = "";
      filter = "all"; renderFilters(); renderList();
    } catch (e) {
      hintEl.textContent = e.status === 401 ? "Log in to post." : e.message;
      hintEl.style.color = "#fb7185";
      if (e.status === 401) window.Auth.open("login");
    } finally { postBtn.disabled = false; }
  }

  function syncComposer(user) {
    if (user) {
      asEl.textContent = "posting as " + user;
      postBtn.textContent = "Post";
      hintEl.textContent = mode === "server" ? "Tips & comps are shared with everyone on the site." : "Saved in this browser (no server connected).";
      hintEl.style.color = "";
    } else {
      asEl.textContent = "";
      postBtn.textContent = "Log in to post";
      hintEl.textContent = "You need an account to post or vote.";
      hintEl.style.color = "";
    }
    renderList();
  }

  textEl.addEventListener("input", () => { countEl.textContent = `${textEl.value.length} / 600`; });
  postBtn.addEventListener("click", post);
  sortEl.addEventListener("change", () => { sort = sortEl.value; renderList(); });

  renderFilters();
  listEl.innerHTML = `<p class="text-sm text-zinc-600 py-10 text-center">Loading…</p>`;

  (async () => {
    mode = (await window.AW3API.ready) ? "server" : "local";
    await refresh();
    if (window.Auth) window.Auth.onChange(syncComposer); else syncComposer(null);
  })();
})();
