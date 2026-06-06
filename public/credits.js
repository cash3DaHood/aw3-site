/* ============================================================
   Credits modal + Discord button.
   ============================================================ */
(function () {
  const CFG = window.AW3_CONFIG || {};
  const discordHref = (window.AW3API && window.AW3API.discordHref()) ||
    (CFG.DISCORD_ID ? "https://discord.com/users/" + CFG.DISCORD_ID : "#");

  /* ---- wire the Discord buttons (nav + footer) ---- */
  ["discordBtn", "discordBtnFoot"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.href = discordHref; el.target = "_blank"; el.rel = "noopener noreferrer"; }
  });

  /* ---- build credits modal ---- */
  const modal = document.createElement("div");
  modal.id = "creditsModal";
  modal.className = "auth-overlay hidden";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="auth-card credits-card" role="dialog" aria-modal="true">
      <button class="auth-close" id="creditsClose" aria-label="Close">&times;</button>
      <div class="auth-head">
        <div class="auth-logo">✦</div>
        <h2>Credits</h2>
        <p class="auth-sub">Anime Warriors III · Secret Calculator</p>
      </div>
      <ul class="credits-list">
        <li><span class="credits-role">Site &amp; tools</span><span class="credits-name">${escapeHtml(CFG.SITE_AUTHOR || "—")}</span></li>
        <li><span class="credits-role">Formula &amp; data</span><span class="credits-name">${escapeHtml(CFG.FORMULA_AUTHORS || "spliax & xtermiz")}</span></li>
        <li><span class="credits-role">The game</span><span class="credits-name">Anime Warriors III (Roblox)</span></li>
      </ul>
      <div id="discordCard" class="dc-card"></div>
      <p class="auth-note">Fan-made tool — not affiliated with or endorsed by the game's developers.</p>
    </div>`;
  document.body.appendChild(modal);

  const open = () => { modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); };
  const close = () => { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); };
  modal.querySelector("#creditsClose").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });

  document.querySelectorAll("[data-credits]").forEach((b) => b.addEventListener("click", open));
  window.AW3Credits = { open, close };

  function discordSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.214.38-.463.892-.636 1.295a18.27 18.27 0 0 0-5.498 0A12.6 12.6 0 0 0 9.11 3 19.74 19.74 0 0 0 4.677 4.37C1.86 8.56 1.097 12.65 1.478 16.68a19.9 19.9 0 0 0 6.063 3.058c.49-.666.927-1.374 1.302-2.118-.714-.27-1.396-.603-2.04-.99.171-.125.339-.255.5-.39 3.927 1.84 8.18 1.84 12.06 0 .164.135.331.265.5.39-.645.388-1.328.72-2.042.99.375.744.811 1.452 1.302 2.118a19.86 19.86 0 0 0 6.064-3.058c.448-4.673-.766-8.726-3.21-12.31zM8.02 14.2c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.955 2.42-2.157 2.42zm7.96 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.946 2.42-2.157 2.42z"/></svg>`;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
})();
