/* ============================================================
   AW3 Secret Calculator — logic
   Formula (by spliax & xtermiz):
     chance% = UnitBase × (1 + SecretChance) × LuckMult
     LuckMult: luck < (14 − StarLuck) ? 1 + (luck+star)×0.5
                                      : 1.7 + (luck+star)×0.05
   ============================================================ */

// Per-unit base chance (%), calibrated so default stats reproduce the sheet's player column exactly.
// Base chance (%) per unit at 0 luck / no GP (chance = base; multipliers = 1). Authoritative values.
const UNITS = [
  { name: "Broly",  base: 1.02484e-4, color: "#34d399", img: "unit_broly.png" },
  { name: "Vegito", base: 8.74e-5,    color: "#22d3ee", img: "unit_vegito.png" },
  { name: "Minato", base: 6.9844e-5,  color: "#a78bfa", img: "unit_minato.png" },
  { name: "Mihawk", base: 5.838e-5,   color: "#fb7185", img: "unit_mihawk.png" },
  { name: "Naruto", base: 4.92875e-5, color: "#fbbf24", img: "unit_naruto.png" },
];

// open-speed calibration constant (default stats -> 4.88 opens/sec, matching the sheet)
const K = 0.128742;

const FIELDS = [
  { id: "secret",  label: "Secret Chance",  suffix: "%", min: 0,   max: 500, step: 1,      def: 50,       group: "main" },
  { id: "shiny",   label: "Shiny Chance",   suffix: "%", min: 0.1, max: 100, step: 0.1,    def: 5,        group: "main" },
  { id: "luck",    label: "Potion Luck",    suffix: "",  min: 0,   max: 60,  step: 0.001,  def: 15.937,   group: "main", hint: true },
  { id: "star",    label: "Star",           type: "select", def: 1, group: "main",
    options: [["Namek · +1", 1], ["Corps · +0.5", 0.5], ["Ninja · +0.2", 0.2], ["Sky · 0", 0], ["Rain · −0.15", -0.15], ["None", 0]] },

  // Fast Open is a gamepass — you either own it (+100% open speed) or you don't.
  { id: "fast",    label: "Fast Open (GP)",  type: "check", on: 100, off: 0, def: 100,     group: "speed" },
  { id: "play",    label: "Playtime Awards", suffix: "%", min: 0, max: 100, step: 1,      def: 100,      group: "speed" },
  { id: "starm",   label: "Star Milestones", suffix: "%", min: 0, max: 100, step: 1,      def: 0,        group: "speed" },
  { id: "weather", label: "Weather",         suffix: "%", min: 0, max: 100, step: 1,      def: 0,        group: "speed" },
  { id: "extra",   label: "Extra Opens",     suffix: "",  min: 0, max: 50,  step: 1,      def: 9,        group: "speed" },
  { id: "relic",   label: "Relic Open Speed",suffix: "",  min: 0, max: 5,   step: 0.0001, def: 0.263580, group: "speed" },
];

const STORE = "aw3calc.v1";
const state = {};

/* ---------- formatting helpers ---------- */
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

function pctStr(p) {
  if (!isFinite(p) || p <= 0) return "0%";
  let s = p.toPrecision(3);
  if (s.includes("e")) s = p.toFixed(14).replace(/0+$/, "");
  return s + "%";
}

function dur(sec) {
  if (!isFinite(sec) || sec <= 0) return "—";
  const Y = 31557600, D = 86400, H = 3600, M = 60;
  if (sec >= Y) { const y = sec / Y; return (y < 10 ? y.toFixed(1) : Math.round(y).toLocaleString()) + " yr"; }
  if (sec >= D) { const d = Math.floor(sec / D); return d + "d " + Math.round((sec - d * D) / H) + "h"; }
  if (sec >= H) { const h = Math.floor(sec / H); return h + "h " + Math.round((sec - h * H) / M) + "m"; }
  if (sec >= M) { const m = Math.floor(sec / M); return m + "m " + Math.round(sec - m * M) + "s"; }
  return Math.round(sec) + "s";
}

function exactHMS(sec) {
  if (!isFinite(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------- core math ---------- */
function compute() {
  const secret = state.secret / 100;
  const shinyRate = state.shiny / 100;
  const luck = state.luck;
  const star = state.star;
  const threshold = 14 - star;
  const luckMult = luck < threshold
    ? 1 + (luck + star) * 0.5
    : 1.7 + (luck + star) * 0.05;

  const speedMult =
    (1 + state.fast / 100 + state.play / 100 + state.starm / 100 + state.weather / 100) *
    (1 + state.relic) *
    (1 + state.extra);
  const opsPerSec = K * speedMult;

  const rows = UNITS.map((u) => {
    const chance = u.base * (1 + secret) * luckMult;     // percent
    const oneIn = 100 / chance;
    const shinyOneIn = shinyRate > 0 ? oneIn / shinyRate : Infinity;
    return {
      ...u,
      chance,
      oneIn,
      timeSec: oneIn / opsPerSec,
      shinyChance: chance * shinyRate,
      shinyOneIn,
      shinyTimeSec: shinyOneIn / opsPerSec,
      baseOneIn: 100 / u.base,
    };
  });
  rows.sort((a, b) => a.oneIn - b.oneIn);
  return { rows, opsPerSec, luckMult, threshold };
}

/* ---------- rendering ---------- */
function fieldHTML(f) {
  const rightCtrl =
    f.type === "select" || f.type === "check"
      ? ""
      : `<div class="flex items-center gap-1">
           <input id="n_${f.id}" type="number" class="num-input !w-[5.5rem] text-right py-1" min="${f.min}" max="${f.max}" step="${f.step}">
           ${f.suffix ? `<span class="text-xs text-zinc-500 w-3">${f.suffix}</span>` : `<span class="w-3"></span>`}
         </div>`;
  const labelRow = `
    <div class="flex items-center justify-between mb-1.5">
      <label class="text-[13px] font-medium text-zinc-300">${f.label}</label>
      ${f.type === "check"
        ? `<input id="c_${f.id}" type="checkbox" class="aw-check" aria-label="${f.label}">`
        : rightCtrl}
    </div>`;

  if (f.type === "select") {
    const opts = f.options.map(([t, v]) => `<option value="${v}">${t}</option>`).join("");
    return `<div>${labelRow}<select id="s_${f.id}" class="sel-input">${opts}</select></div>`;
  }
  // checkbox: label + toggle, no slider
  if (f.type === "check") return `<div>${labelRow}</div>`;

  const hint = f.hint
    ? `<p id="hint_${f.id}" class="mt-1 text-[11px] text-zinc-500"></p>`
    : "";
  return `<div>${labelRow}
    <input id="r_${f.id}" type="range" min="${f.min}" max="${f.max}" step="${f.step}">
    ${hint}
  </div>`;
}

function renderControls() {
  const main = FIELDS.filter((f) => f.group === "main").map(fieldHTML).join("");
  const speed = FIELDS.filter((f) => f.group === "speed").map(fieldHTML).join("");

  document.getElementById("controls").innerHTML = `
    <div class="flex items-center gap-2 mb-4">
      <span class="h-2 w-2 rounded-full bg-indigo-400"></span>
      <h2 class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400">Your Stats</h2>
    </div>
    <div class="space-y-4">${main}</div>

    <details class="group mt-5 pt-5 border-t border-white/10" open>
      <summary class="flex items-center justify-between cursor-pointer list-none select-none">
        <span class="text-[13px] font-semibold tracking-wide uppercase text-zinc-400 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-fuchsia-400"></span>Open Speed
        </span>
        <svg class="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="space-y-4 mt-4">${speed}</div>
    </details>`;

  // wire up each field
  FIELDS.forEach((f) => {
    if (f.type === "select") {
      const sel = document.getElementById("s_" + f.id);
      sel.value = String(state[f.id]);
      sel.addEventListener("change", () => { state[f.id] = parseFloat(sel.value); update(); });
    } else if (f.type === "check") {
      const c = document.getElementById("c_" + f.id);
      c.checked = state[f.id] === f.on;
      c.addEventListener("change", () => { state[f.id] = c.checked ? f.on : f.off; update(); });
    } else {
      const r = document.getElementById("r_" + f.id);
      const n = document.getElementById("n_" + f.id);
      r.value = state[f.id]; n.value = state[f.id];
      const sync = (val, fromRange) => {
        let v = parseFloat(val);
        if (isNaN(v)) return;
        v = Math.min(f.max, Math.max(f.min, v));
        state[f.id] = v;
        if (fromRange) n.value = +v.toFixed(4); else r.value = v;
        update();
      };
      r.addEventListener("input", () => sync(r.value, true));
      n.addEventListener("input", () => sync(n.value, false));
    }
  });
}

function rankLabel(i, total) {
  if (i === 0) return ["Best odds", "text-emerald-300/90 bg-emerald-400/10 border-emerald-400/20"];
  if (i === total - 1) return ["Rarest", "text-rose-300/90 bg-rose-400/10 border-rose-400/20"];
  return [null, ""];
}

function cardHTML(r, i, total, maxChance) {
  const [rank, rankCls] = rankLabel(i, total);
  const barW = Math.max(4, (r.chance / maxChance) * 100);
  return `
  <div class="fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 hover:border-white/20 transition-colors"
       style="--c:${r.color}">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${r.img}" alt="${r.name}" loading="lazy"
             class="unit-img h-16 w-16 rounded-xl object-cover object-top shrink-0"
             style="border-color:${r.color}59; box-shadow:0 7px 22px -9px ${r.color}, 0 0 0 1px ${r.color}26">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-zinc-100 leading-tight" title="${r.name}">${r.name}</h3>
          <span class="text-[11px] text-zinc-500">Secret unit</span>
        </div>
      </div>
      ${rank ? `<span class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${rankCls}">${rank}</span>` : ""}
    </div>

    <div class="mt-3">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500">Your chance</div>
      <div class="text-2xl sm:text-[28px] font-extrabold text-zinc-50 leading-tight tabular-nums">
        1 in ${fmtInt(r.oneIn)}
      </div>
      <div class="text-xs text-zinc-500 mt-0.5">${pctStr(r.chance)} per open</div>
    </div>

    <div class="mt-3 rarity-track"><div class="rarity-fill" style="width:${barW}%;background:${r.color}"></div></div>

    <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
      <div>
        <div class="text-zinc-500">Avg. grind time</div>
        <div class="font-semibold text-zinc-200" title="${exactHMS(r.timeSec)}">${dur(r.timeSec)}</div>
      </div>
      <div>
        <div class="text-zinc-500">Avg. opens</div>
        <div class="font-semibold text-zinc-200">${fmtInt(r.oneIn)}</div>
      </div>
    </div>

    <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5 text-zinc-400">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="${r.color}"><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z"/></svg>
        Shiny
      </div>
      <div class="text-right">
        <div class="font-semibold text-zinc-200 tabular-nums">1 in ${fmtInt(r.shinyOneIn)}</div>
        <div class="text-zinc-500" title="${exactHMS(r.shinyTimeSec)}">${dur(r.shinyTimeSec)}</div>
      </div>
    </div>

    <div class="mt-2 text-[11px] text-zinc-600">Base (no bonuses): 1 in ${fmtInt(r.baseOneIn)}</div>
  </div>`;
}

function update() {
  const { rows, opsPerSec, luckMult, threshold } = compute();
  const maxChance = Math.max(...rows.map((r) => r.chance));
  document.getElementById("results").innerHTML =
    rows.map((r, i) => cardHTML(r, i, rows.length, maxChance)).join("");

  document.getElementById("opsRate").innerHTML =
    `<span class="text-zinc-300 font-semibold tabular-nums">${opsPerSec.toFixed(2)}</span> opens / sec` +
    `<span class="block text-[11px]">luck ×${luckMult.toFixed(3)}</span>`;

  // luck breakpoint hint
  const hint = document.getElementById("hint_luck");
  if (hint) {
    const over = state.luck >= threshold;
    hint.innerHTML = over
      ? `<span class="text-amber-400/90">Above breakpoint (${threshold}). Luck now scales ×0.05 (soft-capped).</span>`
      : `<span class="text-emerald-400/90">Below breakpoint (${threshold}). Luck scales ×0.5.</span>`;
  }
  save();
}

/* ---------- persistence ---------- */
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
}
function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}
  FIELDS.forEach((f) => {
    let v = (f.id in saved) ? saved[f.id] : f.def;
    if (f.type === "check") {
      v = (isFinite(v) ? v : f.def) >= (f.on + f.off) / 2 ? f.on : f.off;
    } else if (f.type !== "select" && typeof f.max === "number") {
      v = Math.min(f.max, Math.max(f.min, isFinite(v) ? v : f.def)); // clamp to current range
    }
    state[f.id] = v;
  });
}
function reset() {
  FIELDS.forEach((f) => { state[f.id] = f.def; });
  renderControls();
  update();
}

/* ---------- public API (used by the simulator) ---------- */
window.AW3 = {
  UNITS,
  FIELDS,
  compute: () => compute(),
  getState: () => state,
  setField(id, val) {
    const f = FIELDS.find((x) => x.id === id);
    if (!f) return;
    let v = parseFloat(val);
    if (isNaN(v)) return;
    if (f.type === "check") v = v >= (f.on + f.off) / 2 ? f.on : f.off;
    else if (f.type !== "select") v = Math.min(f.max, Math.max(f.min, v));
    state[id] = v;
    const r = document.getElementById("r_" + id);
    const n = document.getElementById("n_" + id);
    const s = document.getElementById("s_" + id);
    const c = document.getElementById("c_" + id);
    if (r) r.value = v;
    if (n) n.value = +v.toFixed(4);
    if (s) s.value = String(v);
    if (c) c.checked = v === f.on;
    update();
  },
  onUpdate(cb) { document.addEventListener("aw3:update", cb); },
};

// wrap update() so any stat change broadcasts to the simulator
const _origUpdate = update;
update = function () {
  _origUpdate();
  document.dispatchEvent(new CustomEvent("aw3:update"));
};

/* ---------- boot ---------- */
load();
renderControls();
update();
document.getElementById("resetBtn").addEventListener("click", reset);
