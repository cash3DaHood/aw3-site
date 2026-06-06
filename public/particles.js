/* ============================================================
   Ambient background FX — constellation / snow / rain
   Always animates. Cursor-reactive. API unchanged:
   Particles.setMode / setAccent / setIntensity / getMode
   ============================================================ */
(function () {
  const canvas = document.getElementById("bg-particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  let DPR = 1, W = 0, H = 0, raf = null, last = 0, running = false;
  let mode = "normal", intensity = 1;
  let accent = { rgb: [129, 140, 248], rgb2: [192, 132, 252] };
  let parts = [];
  const mouse = { x: -9999, y: -9999, active: false };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hexRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  const sprites = {};
  function sprite(key, rgb) {
    if (sprites[key]) return sprites[key];
    const s = 48, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.85)`);
    grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); g.fill();
    sprites[key] = c; return c;
  }
  const clearSprites = () => { for (const k in sprites) delete sprites[k]; };

  function targetCount() {
    const area = W * H;
    const div = mode === "rain" ? 7000 : mode === "snow" ? 11000 : 16000;
    const cap = mode === "rain" ? 280 : mode === "normal" ? 115 : 150;
    return clamp(Math.round((area / div) * intensity), 30, cap);
  }
  function mk(seeded) {
    const depth = 0.35 + Math.random() * 0.65;
    if (mode === "rain") {
      return { x: Math.random() * W, y: seeded ? Math.random() * H : -rnd(0, H), depth,
        len: rnd(12, 30) * (0.6 + depth), vy: rnd(420, 820) * (0.6 + depth * 0.7), vx: -rnd(30, 80) * depth,
        w: rnd(0.6, 1.8) * depth + 0.3, alpha: rnd(0.12, 0.4) };
    }
    if (mode === "snow") {
      return { x: Math.random() * W, y: seeded ? Math.random() * H : -rnd(0, H), depth,
        r: rnd(1.6, 4.6) * depth, vy: rnd(26, 70) * depth, sx: rnd(20, 60), sf: rnd(0.2, 0.7),
        ph: Math.random() * 7, a: rnd(0.4, 0.95), tf: rnd(0.4, 1.4), tp: Math.random() * 7 };
    }
    const ang = Math.random() * Math.PI * 2, sp = rnd(16, 46) * (0.5 + depth);
    return { x: Math.random() * W, y: Math.random() * H, depth,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      r: rnd(1.4, 3.2) * (0.6 + depth), a: rnd(0.45, 0.95), tf: rnd(0.5, 1.6), tp: Math.random() * 7 };
  }
  function rebuild() { parts = []; if (mode === "off") return; const n = targetCount(); for (let i = 0; i < n; i++) parts.push(mk(true)); }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); rebuild();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (mode === "off" || !parts.length) return;
    const r = accent.rgb, r2 = accent.rgb2;

    if (mode === "rain") {
      ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (const p of parts) {
        const dx = (p.vx / p.vy) * p.len;
        ctx.strokeStyle = `rgba(${r[0]},${r[1]},${r[2]},${p.alpha})`; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx, p.y + p.len); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over"; return;
    }
    if (mode === "snow") {
      ctx.globalCompositeOperation = "lighter";
      const sp = sprite("snow", [255, 255, 255]);
      for (const p of parts) {
        const sway = Math.sin(t * p.sf + p.ph) * p.sx;
        const tw = 0.75 + 0.25 * Math.sin(t * p.tf + p.tp), size = p.r * 7;
        ctx.globalAlpha = Math.min(1, p.a * tw);
        ctx.drawImage(sp, p.x + sway - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; return;
    }

    // ---- normal: constellation ----
    const maxD = 134, mouseD = 200;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < maxD * maxD) {
          const al = (1 - Math.sqrt(d2) / maxD) * 0.22;
          ctx.strokeStyle = `rgba(${r[0]},${r[1]},${r[2]},${al})`;
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < mouseD * mouseD) {
          const al = (1 - Math.sqrt(d2) / mouseD) * 0.45;
          ctx.strokeStyle = `rgba(${r2[0]},${r2[1]},${r2[2]},${al})`;
          ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = "lighter";
    const sp = sprite("acc", r);
    for (const p of parts) {
      const tw = 0.7 + 0.3 * Math.sin(t * p.tf + p.tp), size = p.r * 6;
      ctx.globalAlpha = Math.min(1, p.a * tw);
      ctx.drawImage(sp, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  function physics(dt) {
    for (const p of parts) {
      if (mode === "rain") {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y - p.len > H) { p.y = -p.len; p.x = Math.random() * W; }
        if (p.x < -40) p.x = W + 40; continue;
      }
      if (mode === "snow") {
        p.y += p.vy * dt; if (p.y - 40 > H) { p.y = -20; p.x = Math.random() * W; } continue;
      }
      // normal: drift + cursor repel + edge wrap
      if (mouse.active) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / 150) * 70; p.vx += (dx / d) * f * dt; p.vy += (dy / d) * f * dt; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp2 = p.vx * p.vx + p.vy * p.vy, mx = 78;
      if (sp2 > mx * mx) { const s = mx / Math.sqrt(sp2); p.vx *= s; p.vy *= s; }
      const m = 30;
      if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
      if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
    }
  }
  function step(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    physics(dt); draw(now / 1000);
    raf = requestAnimationFrame(step);
  }
  function start() { if (running || mode === "off") return; running = true; last = performance.now(); raf = requestAnimationFrame(step); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } }

  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
  window.addEventListener("pointerout", () => { mouse.active = false; });
  window.addEventListener("blur", () => { mouse.active = false; });
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

  window.Particles = {
    setMode(m) { mode = m; stop(); resize(); if (mode === "off") ctx.clearRect(0, 0, W, H); else start(); },
    setAccent(hex, hex2) { accent = { rgb: hexRgb(hex), rgb2: hexRgb(hex2 || hex) }; clearSprites(); },
    setIntensity(v) { intensity = clamp(v, 0.3, 2); resize(); if (!running && mode !== "off") start(); },
    getMode() { return mode; },
  };

  resize(); start();
})();
