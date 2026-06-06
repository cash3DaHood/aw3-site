/* ============================================================
   Settings — accent colour, background effect, density
   ============================================================ */
(function () {
  const ACCENTS = [
    { n: "Indigo",  hex: "#818cf8", hex2: "#c084fc" },
    { n: "Violet",  hex: "#a78bfa", hex2: "#e879f9" },
    { n: "Blue",    hex: "#60a5fa", hex2: "#818cf8" },
    { n: "Cyan",    hex: "#22d3ee", hex2: "#38bdf8" },
    { n: "Emerald", hex: "#34d399", hex2: "#22d3ee" },
    { n: "Rose",    hex: "#fb7185", hex2: "#f472b6" },
    { n: "Amber",   hex: "#fbbf24", hex2: "#fb923c" },
    { n: "Crimson", hex: "#f87171", hex2: "#fbbf24" },
  ];
  const K_ACCENT = "aw3.accent", K_MODE = "aw3.bgmode", K_INT = "aw3.bgint";
  const root = document.documentElement;

  const hexRgb = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const lighten = (hex, amt) => {
    let [r, g, b] = hexRgb(hex);
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const load = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  function applyAccent(hex, hex2) {
    hex2 = hex2 || lighten(hex, 0.25);
    const [r, g, b] = hexRgb(hex), [r2, g2, b2] = hexRgb(hex2);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-2", hex2);
    root.style.setProperty("--accent-rgb", `${r},${g},${b}`);
    root.style.setProperty("--accent2-rgb", `${r2},${g2},${b2}`);
    if (window.Particles) window.Particles.setAccent(hex, hex2);
  }

  /* ---- accent ---- */
  let cur = { hex: "#818cf8", hex2: "#c084fc" };
  const savedA = load(K_ACCENT);
  if (savedA) { try { cur = JSON.parse(savedA); } catch (e) {} }
  applyAccent(cur.hex, cur.hex2);

  const sw = document.getElementById("swatches");
  const customInput = document.createElement("input");
  customInput.type = "color"; customInput.className = "color-input"; customInput.value = cur.hex;

  const markActiveSwatch = () =>
    [...sw.querySelectorAll(".swatch")].forEach((b) =>
      b.classList.toggle("active", b.dataset.hex.toLowerCase() === cur.hex.toLowerCase()));

  ACCENTS.forEach((a) => {
    const b = document.createElement("button");
    b.className = "swatch"; b.title = a.n;
    b.dataset.hex = a.hex; b.dataset.hex2 = a.hex2;
    b.style.background = a.hex; b.style.color = a.hex;
    b.addEventListener("click", () => {
      cur = { hex: a.hex, hex2: a.hex2 };
      applyAccent(cur.hex, cur.hex2); save(K_ACCENT, JSON.stringify(cur));
      customInput.value = a.hex; markActiveSwatch();
    });
    sw.appendChild(b);
  });

  const customWrap = document.createElement("label");
  customWrap.className = "custom-swatch"; customWrap.title = "Custom colour";
  customInput.addEventListener("input", () => {
    const h = customInput.value;
    cur = { hex: h, hex2: lighten(h, 0.25) };
    applyAccent(cur.hex, cur.hex2); save(K_ACCENT, JSON.stringify(cur));
    markActiveSwatch();
  });
  customWrap.appendChild(customInput);
  sw.appendChild(customWrap);
  markActiveSwatch();

  /* ---- background mode ---- */
  let mode = load(K_MODE) || "normal";
  const modeBtns = [...document.querySelectorAll("#bgModes .mode-btn")];
  const markMode = () => modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  if (window.Particles) window.Particles.setMode(mode);
  markMode();
  modeBtns.forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    if (window.Particles) window.Particles.setMode(mode);
    save(K_MODE, mode); markMode();
  }));

  /* ---- density ---- */
  let intensity = parseFloat(load(K_INT));
  if (!isFinite(intensity)) intensity = 1;
  const intBtns = [...document.querySelectorAll("#bgIntensity .mode-btn")];
  const markInt = () => intBtns.forEach((b) => b.classList.toggle("active", parseFloat(b.dataset.int) === intensity));
  if (window.Particles) window.Particles.setIntensity(intensity);
  markInt();
  intBtns.forEach((b) => b.addEventListener("click", () => {
    intensity = parseFloat(b.dataset.int);
    if (window.Particles) window.Particles.setIntensity(intensity);
    save(K_INT, String(intensity)); markInt();
  }));

  /* ---- panel toggle ---- */
  const btn = document.getElementById("settingsBtn");
  const panel = document.getElementById("settingsPanel");
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.classList.toggle("hidden"); });
  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("hidden") && !panel.contains(e.target) && !btn.contains(e.target))
      panel.classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") panel.classList.add("hidden"); });
})();
