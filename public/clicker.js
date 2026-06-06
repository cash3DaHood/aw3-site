/* ============================================================
   Gem Clicker — AW3-themed idle game (v2)
   Click capsule for Gems · generators · click upgrades ·
   bulk-buy · golden capsules + frenzies · click crits ·
   prestige (Star Shards) · achievements · offline earnings.
   Saves per logged-in user (or 'guest').
   ============================================================ */
(function () {
  const root = document.getElementById("clicker-root");
  if (!root) return;

  const GENERATORS = [
    { id: "opener", icon: "📦", name: "Auto Opener",   desc: "Cracks capsules on its own",  base: 15,    rate: 0.2 },
    { id: "potion", icon: "🧪", name: "Lucky Potion",   desc: "A steady trickle of gems",     base: 110,   rate: 1 },
    { id: "magnet", icon: "🧲", name: "Gem Magnet",     desc: "Pulls loose gems toward you",  base: 1200,  rate: 8 },
    { id: "forge",  icon: "⭐", name: "Star Forge",     desc: "Forges gems out of stars",     base: 13000, rate: 47 },
    { id: "drill",  icon: "⛏️", name: "Relic Drill",    desc: "Mines ancient relic gems",     base: 140000, rate: 260 },
    { id: "portal", icon: "🌀", name: "Secret Portal",  desc: "Channels secret-unit energy",  base: 1.6e6, rate: 1400 },
    { id: "rift",   icon: "🌌", name: "Rift Engine",    desc: "Tears open gem rifts",         base: 2.0e7, rate: 7800 },
    { id: "core",   icon: "💠", name: "Dimension Core", desc: "Bends reality for gems",       base: 3.3e8, rate: 44000 },
  ];
  const CLICKUPS = [
    { id: "tap",   icon: "👆", name: "Reinforced Tap", desc: "+1 gem per click",   base: 50,     add: 1 },
    { id: "surge", icon: "⚡", name: "Power Surge",    desc: "+6 gems per click",  base: 4000,   add: 6 },
    { id: "nova",  icon: "✦", name: "Gem Nova",        desc: "+40 gems per click", base: 250000, add: 40 },
  ];
  const ACHS = [
    { id: "a1",  name: "First Gem",      desc: "Earn 100 gems",        test: (d) => d.life >= 100,   bonus: 0.01 },
    { id: "a2",  name: "Capsule Cracker",desc: "Earn 10K gems",        test: (d) => d.life >= 1e4,   bonus: 0.02 },
    { id: "a3",  name: "Gem Hoarder",    desc: "Earn 1M gems",         test: (d) => d.life >= 1e6,   bonus: 0.03 },
    { id: "a4",  name: "Billionaire",    desc: "Earn 1B gems",         test: (d) => d.life >= 1e9,   bonus: 0.05 },
    { id: "a5",  name: "Trigger Finger", desc: "Click 500 times",      test: (d) => d.clicks >= 500, bonus: 0.02 },
    { id: "a6",  name: "Machine",        desc: "Click 5,000 times",    test: (d) => d.clicks >= 5000,bonus: 0.03 },
    { id: "a7",  name: "Idle Master",    desc: "Reach 1K gems/sec",    test: (d) => d.rate >= 1000,  bonus: 0.03 },
    { id: "a8",  name: "Factory",        desc: "Reach 100K gems/sec",  test: (d) => d.rate >= 1e5,   bonus: 0.05 },
    { id: "a9",  name: "Ascendant",      desc: "Ascend at least once", test: (d) => d.shards >= 1,   bonus: 0.05 },
    { id: "a10", name: "Star Lord",      desc: "Hold 50 Star Shards",  test: (d) => d.shards >= 50,  bonus: 0.10 },
  ];
  const GEN_G = 1.15, CUP_G = 1.32, OFFLINE_CAP = 8 * 3600, OFFLINE_EFF = 0.5;
  const SHARD_BONUS = 0.02, CRIT_CHANCE = 0.05, CRIT_MULT = 10;
  const GOLD_MIN = 50, GOLD_MAX = 100, GOLD_LIFE = 11, FRENZY_MULT = 7, FRENZY_SEC = 13;

  /* ---------- format ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SUFF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  function fmt(n) {
    if (!isFinite(n)) return "∞";
    if (n < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, "");
    const t = Math.floor(Math.log10(n) / 3), s = SUFF[t] || "e" + t * 3;
    return (n / Math.pow(10, t * 3)).toFixed(2) + s;
  }
  const oneCost = (base, o, g) => Math.ceil(base * Math.pow(g, o));
  const sumCost = (base, o, g, n) => Math.ceil(base * Math.pow(g, o) * (Math.pow(g, n) - 1) / (g - 1));
  function maxAff(base, o, g, money) {
    const first = base * Math.pow(g, o);
    if (money < first) return 0;
    return Math.max(0, Math.floor(Math.log(money * (g - 1) / first + 1) / Math.log(g)));
  }

  /* ---------- state ---------- */
  let slot = "aw3.clicker.guest", st = blank();
  let buff = null, amt = 1, goldEl = null, goldT = null;
  function blank() { return { gems: 0, total: 0, life: 0, clicks: 0, gen: {}, cup: {}, shards: 0, achs: {}, last: Date.now() }; }
  const slotKey = () => "aw3.clicker." + ((window.Auth && window.Auth.current()) || "guest");

  function baseRate() { return GENERATORS.reduce((s, g) => s + g.rate * (st.gen[g.id] || 0), 0); }
  function achMult() { return 1 + ACHS.reduce((s, a) => s + (st.achs[a.id] ? a.bonus : 0), 0); }
  function frenzyMult() { return (buff && performance.now() < buff.until) ? buff.mult : 1; }
  function globalMult() { return (1 + st.shards * SHARD_BONUS) * achMult() * frenzyMult(); }
  function rate() { return baseRate() * globalMult(); }
  function perClick() { return (1 + CLICKUPS.reduce((s, c) => s + c.add * (st.cup[c.id] || 0), 0)) * globalMult(); }
  function shardsToGain() { return Math.max(0, Math.floor(Math.sqrt(st.life / 1e6)) - st.shards); }
  function nextShardNeed() { const target = st.shards + shardsToGain() + 1; return target * target * 1e6; }

  function loadSlot() {
    slot = slotKey();
    try { st = Object.assign(blank(), JSON.parse(localStorage.getItem(slot)) || {}); } catch (e) { st = blank(); }
    st.gen = st.gen || {}; st.cup = st.cup || {}; st.achs = st.achs || {};
    if (st.life == null) st.life = st.total || 0;
    const away = Math.max(0, (Date.now() - (st.last || Date.now())) / 1000);
    const gained = rate() * Math.min(away, OFFLINE_CAP) * OFFLINE_EFF;
    if (gained >= 1) { st.gems += gained; st.total += gained; st.life += gained; toast(`Welcome back — you earned <b>${fmt(gained)}</b> gems while away (${fmtT(Math.min(away, OFFLINE_CAP))}).`); }
    st.last = Date.now();
  }
  const save = () => { st.last = Date.now(); try { localStorage.setItem(slot, JSON.stringify(st)); } catch (e) {} };
  function fmtT(sec) { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m` : `${Math.floor(sec)}s`; }

  /* ---------- UI ---------- */
  root.innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-5 sm:gap-6">
    <div class="clk-stage">
      <div class="clk-bal">
        <div class="clk-gem">💎</div>
        <div>
          <div id="c-gems" class="clk-gems">0</div>
          <div class="clk-gems-sub"><span id="c-rate">0</span> / sec · <span id="c-mult" class="text-zinc-400">×1.00</span></div>
        </div>
      </div>
      <button id="gemOrb" class="clk-orb" aria-label="Open a capsule">
        <span class="clk-orb-inner">💎</span><span class="clk-orb-ring"></span>
      </button>
      <div class="clk-perclick">+<span id="c-perclick">1</span> per click</div>
      <div id="c-buff" class="clk-buff hidden"></div>
      <div class="clk-mini">
        <div><span class="clk-mini-k">Total earned</span><span id="c-total" class="clk-mini-v">0</span></div>
        <div><span class="clk-mini-k">Clicks</span><span id="c-clicks" class="clk-mini-v">0</span></div>
        <div><span class="clk-mini-k">Star Shards</span><span id="c-shards" class="clk-mini-v">0</span></div>
      </div>
      <div class="clk-ascend">
        <div class="clk-asc-head">
          <span>✦ Ascension</span>
          <span id="c-asc-bonus" class="clk-asc-bonus">+0%</span>
        </div>
        <div id="c-asc-prog" class="clk-asc-prog"><div id="c-asc-bar" class="clk-asc-bar"></div></div>
        <button id="c-ascend" class="clk-asc-btn" disabled>Ascend</button>
        <p class="clk-asc-note">Reset progress for permanent <b>+2%</b> production per shard.</p>
      </div>
      <button id="c-reset" class="clk-reset">Reset everything</button>
    </div>

    <div class="space-y-5">
      <div>
        <div class="flex items-center justify-between gap-2 mb-3 px-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-indigo-400"></span>
            <h3 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Generators</h3>
          </div>
          <div class="buy-toggle" id="c-buyamt">
            <button data-amt="1" class="buy-amt active">×1</button>
            <button data-amt="10" class="buy-amt">×10</button>
            <button data-amt="max" class="buy-amt">Max</button>
          </div>
        </div>
        <div id="c-gens" class="space-y-2"></div>
      </div>
      <div>
        <div class="flex items-center gap-2 mb-3 px-1">
          <span class="h-2 w-2 rounded-full bg-fuchsia-400"></span>
          <h3 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Click upgrades</h3>
        </div>
        <div id="c-cups" class="space-y-2"></div>
      </div>
      <div>
        <div class="flex items-center justify-between gap-2 mb-3 px-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-amber-400"></span>
            <h3 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Achievements</h3>
          </div>
          <span id="c-ach-count" class="text-[11px] text-zinc-500">0 / ${ACHS.length}</span>
        </div>
        <div id="c-achs" class="flex flex-wrap gap-2"></div>
      </div>
    </div>
  </div>
  <div id="c-toast" class="clk-toast hidden"></div>`;

  const stageEl = root.querySelector(".clk-stage");
  const orb = root.querySelector("#gemOrb");
  const $ = (id) => root.querySelector(id);
  const toastEl = $("#c-toast");

  /* ---------- shop ---------- */
  function rowBuy(kind, item) {
    const store = kind === "gen" ? st.gen : st.cup, g = kind === "gen" ? GEN_G : CUP_G;
    const owned = store[item.id] || 0;
    const ma = maxAff(item.base, owned, g, st.gems);
    let nBuy = amt === "max" ? ma : Math.min(amt, ma);
    const shown = Math.max(1, nBuy);
    const cost = sumCost(item.base, owned, g, shown);
    return { owned, nBuy, shown, cost, can: nBuy >= 1 };
  }
  function shopRowHTML(kind, item) {
    const b = rowBuy(kind, item);
    return `<button class="shop-row ${b.can ? "can" : ""}" data-kind="${kind}" data-id="${item.id}" ${b.can ? "" : "disabled"}>
      <span class="shop-ico">${item.icon}</span>
      <span class="shop-main">
        <span class="shop-name">${item.name}<b class="shop-own">${b.owned}</b></span>
        <span class="shop-desc">${item.desc}</span>
      </span>
      <span class="shop-buy">
        <span class="shop-buyn">+${fmt(b.shown)}</span>
        <span class="shop-cost"><span class="shop-gem">💎</span>${fmt(b.cost)}</span>
      </span>
    </button>`;
  }
  function renderShop() {
    $("#c-gens").innerHTML = GENERATORS.map((g) => shopRowHTML("gen", g)).join("");
    $("#c-cups").innerHTML = CLICKUPS.map((u) => shopRowHTML("cup", u)).join("");
    root.querySelectorAll(".shop-row").forEach((b) => b.addEventListener("click", () => buy(b.dataset.kind, b.dataset.id)));
  }
  function updateShop() {
    [["gen", GENERATORS], ["cup", CLICKUPS]].forEach(([kind, list]) => {
      list.forEach((item) => {
        const el = root.querySelector(`.shop-row[data-kind="${kind}"][data-id="${item.id}"]`);
        if (!el) return;
        const b = rowBuy(kind, item);
        el.querySelector(".shop-own").textContent = fmt(b.owned);
        el.querySelector(".shop-buyn").textContent = "+" + fmt(b.shown);
        el.querySelector(".shop-cost").innerHTML = `<span class="shop-gem">💎</span>${fmt(b.cost)}`;
        el.classList.toggle("can", b.can); el.disabled = !b.can;
      });
    });
  }
  function buy(kind, id) {
    const list = kind === "gen" ? GENERATORS : CLICKUPS;
    const item = list.find((x) => x.id === id); if (!item) return;
    const store = kind === "gen" ? st.gen : st.cup, g = kind === "gen" ? GEN_G : CUP_G;
    const b = rowBuy(kind, item); if (b.nBuy < 1) return;
    const cost = sumCost(item.base, b.owned, g, b.nBuy);
    if (st.gems < cost) return;
    st.gems -= cost; store[id] = b.owned + b.nBuy;
    updateShop(); paint(); checkAchs(); save();
  }

  /* ---------- achievements ---------- */
  function renderAchs() {
    let n = 0;
    $("#c-achs").innerHTML = ACHS.map((a) => {
      const on = !!st.achs[a.id]; if (on) n++;
      return `<span class="ach ${on ? "on" : ""}" title="${a.desc}${on ? "" : " (locked)"} · +${Math.round(a.bonus * 100)}%">🏆 ${a.name}</span>`;
    }).join("");
    $("#c-ach-count").textContent = `${n} / ${ACHS.length}`;
  }
  function checkAchs() {
    const d = { life: st.life, clicks: st.clicks, rate: baseRate(), shards: st.shards };
    let changed = false;
    ACHS.forEach((a) => {
      if (!st.achs[a.id] && a.test(d)) { st.achs[a.id] = 1; changed = true; toast(`🏆 <b>${a.name}</b> — ${a.desc} (+${Math.round(a.bonus * 100)}% boost)`); }
    });
    if (changed) { renderAchs(); }
  }

  /* ---------- ascension ---------- */
  function renderAscend() {
    const gain = shardsToGain();
    $("#c-shards").textContent = fmt(st.shards);
    $("#c-asc-bonus").textContent = "+" + Math.round(st.shards * SHARD_BONUS * 100) + "%";
    const btn = $("#c-ascend");
    btn.disabled = gain < 1;
    btn.textContent = gain >= 1 ? `Ascend  ·  +${gain} ✦` : "Ascend";
    const need = nextShardNeed(), prog = clamp01(st.life / need);
    $("#c-asc-bar").style.width = (prog * 100).toFixed(1) + "%";
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function ascend() {
    const gain = shardsToGain(); if (gain < 1) return;
    if (!confirm(`Ascend now?\n\nYou'll reset gems, generators and upgrades, but gain ${gain} Star Shard${gain > 1 ? "s" : ""} (+${gain * 2}% permanent production). Achievements & shards are kept.`)) return;
    st.shards += gain; st.gems = 0; st.total = 0; st.gen = {}; st.cup = {}; st.clicks = 0;
    buff = null;
    renderShop(); renderAscend(); paint(); checkAchs(); save();
    if (window.AW3Clicker) window.AW3Clicker.submitScore(true);
    toast(`✦ <b>Ascended!</b> +${gain} Star Shards — now +${st.shards * 2}% production.`);
  }

  /* ---------- golden capsule ---------- */
  function scheduleGold() { clearTimeout(goldT); goldT = setTimeout(spawnGold, rnd(GOLD_MIN, GOLD_MAX) * 1000); }
  function removeGold() { if (goldEl) { goldEl.remove(); goldEl = null; } }
  function spawnGold() {
    removeGold();
    const el = document.createElement("button");
    el.className = "clk-golden"; el.innerHTML = "✦"; el.title = "Quick! Click the golden capsule";
    el.style.left = rnd(8, 78) + "%"; el.style.top = rnd(16, 74) + "%";
    stageEl.appendChild(el); goldEl = el;
    const life = setTimeout(() => { removeGold(); scheduleGold(); }, GOLD_LIFE * 1000);
    el.addEventListener("click", () => { clearTimeout(life); removeGold(); rewardGold(); scheduleGold(); });
  }
  function rewardGold() {
    if (Math.random() < 0.6) { buff = { mult: FRENZY_MULT, until: performance.now() + FRENZY_SEC * 1000 }; toast(`🌟 <b>Gem Frenzy!</b> ×${FRENZY_MULT} production for ${FRENZY_SEC}s`); }
    else { const lump = Math.max(rate() * 60, st.gems * 0.10, perClick() * 60, 50); st.gems += lump; st.total += lump; st.life += lump; toast(`🎁 <b>Lucky capsule!</b> +${fmt(lump)} gems`); }
    paint(); checkAchs();
  }

  /* ---------- paint ---------- */
  function paint() {
    $("#c-gems").textContent = fmt(st.gems);
    $("#c-rate").textContent = fmt(rate());
    $("#c-mult").textContent = "×" + globalMult().toFixed(2);
    $("#c-perclick").textContent = fmt(perClick());
    $("#c-total").textContent = fmt(st.total);
    $("#c-clicks").textContent = fmt(st.clicks);
    updateShop(); renderAscend();
    // buff banner
    const bf = $("#c-buff");
    if (buff && performance.now() < buff.until) {
      const left = Math.ceil((buff.until - performance.now()) / 1000);
      bf.classList.remove("hidden"); bf.innerHTML = `🌟 Frenzy ×${buff.mult} · <b>${left}s</b>`;
    } else { if (buff) buff = null; bf.classList.add("hidden"); }
  }

  /* ---------- click ---------- */
  function float(x, y, txt, cls) {
    const s = document.createElement("span");
    s.className = "clk-float " + (cls || ""); s.textContent = txt;
    s.style.left = x + "px"; s.style.top = y + "px";
    stageEl.appendChild(s); setTimeout(() => s.remove(), 850);
  }
  orb.addEventListener("click", (e) => {
    const crit = Math.random() < CRIT_CHANCE;
    const gain = perClick() * (crit ? CRIT_MULT : 1);
    st.gems += gain; st.total += gain; st.life += gain; st.clicks++;
    orb.classList.remove("pop"); void orb.offsetWidth; orb.classList.add("pop");
    const r = stageEl.getBoundingClientRect();
    float(e.clientX - r.left, e.clientY - r.top, (crit ? "CRIT +" : "+") + fmt(gain), crit ? "crit" : "");
    paint(); if (st.clicks % 10 === 0) checkAchs();
  });
  $("#c-reset").addEventListener("click", () => {
    if (confirm("Hard reset EVERYTHING (gems, shards, achievements)? This can't be undone.")) {
      st = blank(); buff = null; renderShop(); renderAchs(); paint(); save();
    }
  });
  $("#c-ascend").addEventListener("click", ascend);
  root.querySelectorAll("#c-buyamt .buy-amt").forEach((b) => b.addEventListener("click", () => {
    amt = b.dataset.amt === "max" ? "max" : parseInt(b.dataset.amt, 10);
    root.querySelectorAll("#c-buyamt .buy-amt").forEach((x) => x.classList.toggle("active", x === b));
    updateShop();
  }));

  /* ---------- toast ---------- */
  let toastT;
  function toast(html) {
    toastEl.innerHTML = html; toastEl.classList.remove("hidden");
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.classList.remove("show"); setTimeout(() => toastEl.classList.add("hidden"), 300); }, 5000);
  }

  /* ---------- loop ---------- */
  let lastTick = performance.now(), achTimer = 0;
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
    const r = rate();
    if (r > 0) { const g = r * dt; st.gems += g; st.total += g; st.life += g; }
    paint();
    achTimer += dt; if (achTimer > 1) { achTimer = 0; checkAchs(); }
  }, 100);
  setInterval(() => { save(); cloudSave(false); }, 5000);
  window.addEventListener("beforeunload", () => { save(); cloudSave(true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); cloudSave(true); } });

  /* ---------- leaderboard score submit ---------- */
  let lastSubmit = 0, submitting = false;
  const scoreSnapshot = () => ({ life: Math.floor(st.life || 0), shards: Math.floor(st.shards || 0), clicks: Math.floor(st.clicks || 0) });
  async function submitScore(force) {
    if (!window.AW3API || !window.AW3API.isOnline()) return;          // demo mode → nothing to submit
    if (!(window.Auth && window.Auth.current())) return;              // must be logged in
    const now = Date.now();
    if (!force && now - lastSubmit < 20000) return;                   // throttle to ~once / 20s
    if (submitting) return;
    submitting = true; lastSubmit = now;
    try { await window.AW3API.post("/api/score", scoreSnapshot()); document.dispatchEvent(new CustomEvent("aw3:score")); }
    catch (e) {}
    finally { submitting = false; }
  }
  window.AW3Clicker = { submitScore, score: scoreSnapshot, cloudSave: (f) => cloudSave(f) };
  setInterval(() => submitScore(false), 20000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) submitScore(true); });
  window.addEventListener("beforeunload", () => submitScore(true));

  /* ---------- cloud save sync (full clicker state, per account) ---------- */
  const cloudReady = () => window.AW3API && window.AW3API.isOnline() && window.Auth && window.Auth.current();
  let lastCloud = 0, cloudSaving = false;
  async function cloudSave(force) {
    if (!cloudReady()) return;                       // demo mode or logged out → localStorage only
    const now = Date.now();
    if (!force && now - lastCloud < 15000) return;   // throttle to ~once / 15s
    if (cloudSaving) return;
    cloudSaving = true; lastCloud = now;
    try { await window.AW3API.post("/api/clicker", { save: st }); } catch (e) {}
    finally { cloudSaving = false; }
  }
  async function cloudLoad() {
    if (!cloudReady()) return null;
    try { return (await window.AW3API.get("/api/clicker")).save || null; } catch (e) { return null; }
  }

  /* ---------- account swap ---------- */
  async function boot() {
    slot = slotKey();
    // merge: keep whichever save has more lifetime gems so switching devices never loses progress
    let local = null; try { local = JSON.parse(localStorage.getItem(slot) || "null"); } catch (e) {}
    const remote = await cloudLoad();
    let chosen = local;
    if (remote && (!local || (remote.life || remote.total || 0) >= (local.life || local.total || 0))) chosen = remote;
    if (chosen) { try { localStorage.setItem(slot, JSON.stringify(chosen)); } catch (e) {} }
    loadSlot(); renderShop(); renderAchs(); paint(); checkAchs();
    submitScore(true); cloudSave(true);
  }
  if (window.Auth) window.Auth.onChange(() => { save(); cloudSave(true); buff = null; boot(); });
  else boot();
  scheduleGold();

  /* ============================================================
     Tab controller (calc / clicker / community) + hero CTAs
     ============================================================ */
  const tabs = [...document.querySelectorAll(".tab-btn")];
  const panels = { calc: document.getElementById("tab-calc"), clicker: document.getElementById("tab-clicker"), leaderboard: document.getElementById("tab-leaderboard"), community: document.getElementById("tab-community") };
  function showTab(t) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    for (const k in panels) panels[k] && panels[k].classList.toggle("hidden", k !== t);
    const rb = document.getElementById("resetBtn"); if (rb) rb.classList.toggle("hidden", t !== "calc");
    if (t === "leaderboard" && window.AW3Leaderboard) window.AW3Leaderboard.refresh();
  }
  tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll(".tab-jump").forEach((b) =>
    b.addEventListener("click", () => { showTab(b.dataset.go); document.querySelector(".tabbar").scrollIntoView({ behavior: "smooth", block: "start" }); }));
})();
