/* ============================================================
   Discord presence — live avatar + online/idle/dnd/offline status.
   Powered by Lanyard (https://github.com/Phineas/lanyard).
   For your PFP & status to show, join the Lanyard Discord ONCE with
   the same account:  https://discord.gg/lanyard  — then it's automatic.
   ============================================================ */
(function () {
  const CFG = window.AW3_CONFIG || {};
  const ID = (CFG.DISCORD_ID || "").trim();
  const NAME_FALLBACK = CFG.SITE_AUTHOR || "Discord";
  const profileHref = CFG.DISCORD_INVITE || (ID ? "https://discord.com/users/" + ID : "#");

  const STATUS = {
    online:  { c: "#23a55a", t: "Online" },
    idle:    { c: "#f0b232", t: "Idle" },
    dnd:     { c: "#f23f43", t: "Do Not Disturb" },
    offline: { c: "#80848e", t: "Offline" },
  };
  const ACT_VERB = { 0: "Playing", 1: "Streaming", 2: "Listening to", 3: "Watching", 5: "Competing in" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DISCORD_LOGO = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.214.38-.463.892-.636 1.295a18.27 18.27 0 0 0-5.498 0A12.6 12.6 0 0 0 9.11 3 19.74 19.74 0 0 0 4.677 4.37C1.86 8.56 1.097 12.65 1.478 16.68a19.9 19.9 0 0 0 6.063 3.058c.49-.666.927-1.374 1.302-2.118-.714-.27-1.396-.603-2.04-.99.171-.125.339-.255.5-.39 3.927 1.84 8.18 1.84 12.06 0 .164.135.331.265.5.39-.645.388-1.328.72-2.042.99.375.744.811 1.452 1.302 2.118a19.86 19.86 0 0 0 6.064-3.058c.448-4.673-.766-8.726-3.21-12.31zM8.02 14.2c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.955 2.42-2.157 2.42zm7.96 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.946 2.42-2.157 2.42z"/></svg>`;

  function avatarUrl(user) {
    if (!user) return null;
    if (user.avatar) {
      const ext = user.avatar.startsWith("a_") ? "gif" : "png";
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
    // default avatar (new username system uses (id>>22)%6)
    let idx = 0;
    try { idx = Number((BigInt(user.id) >> 22n) % 6n); } catch (e) { idx = (parseInt(user.discriminator || "0", 10) || 0) % 5; }
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  function activityText(d) {
    if (!d || !Array.isArray(d.activities)) return "";
    const custom = d.activities.find((a) => a.type === 4);
    if (custom && custom.state) return (custom.emoji && custom.emoji.name ? custom.emoji.name + " " : "") + custom.state;
    const act = d.activities.find((a) => a.type !== 4);
    if (act) return (ACT_VERB[act.type] || "Playing") + " " + act.name;
    return "";
  }

  let lastData = null, monitored = false;

  function renderCard(state) {
    const card = document.getElementById("discordCard");
    if (!card) return;
    if (!state || state.error) {
      card.innerHTML = `
        <div class="dc-top">
          <div class="dc-ava-wrap"><div class="dc-ava dc-ava-fallback">${DISCORD_LOGO}</div></div>
          <div class="dc-meta">
            <div class="dc-name">${esc(NAME_FALLBACK)}</div>
            <div class="dc-status muted">Live status off</div>
            <div class="dc-activity">Join <b>discord.gg/lanyard</b> with this account to show your avatar &amp; status here.</div>
          </div>
        </div>
        <a class="discord-btn discord-btn-lg" href="${profileHref}" target="_blank" rel="noopener noreferrer">${DISCORD_LOGO}<span>View my profile</span></a>`;
      return;
    }
    const u = state.discord_user || {};
    const s = STATUS[state.discord_status] || STATUS.offline;
    const nm = u.global_name || u.username || NAME_FALLBACK;
    const act = activityText(state);
    card.innerHTML = `
      <div class="dc-top">
        <div class="dc-ava-wrap">
          <img class="dc-ava" src="${avatarUrl(u)}" alt="${esc(nm)}" referrerpolicy="no-referrer">
          <span class="dc-dot" style="background:${s.c}"></span>
        </div>
        <div class="dc-meta">
          <div class="dc-name">${esc(nm)}</div>
          <div class="dc-status"><span class="dc-status-dot" style="background:${s.c}"></span>${s.t}</div>
          ${act ? `<div class="dc-activity">${esc(act)}</div>` : ""}
        </div>
      </div>
      <a class="discord-btn discord-btn-lg" href="${profileHref}" target="_blank" rel="noopener noreferrer">${DISCORD_LOGO}<span>Add me on Discord</span></a>`;
  }

  function updateNav(state) {
    const btn = document.getElementById("discordBtn");
    if (!btn) return;
    if (state && !state.error && state.discord_user) {
      const s = STATUS[state.discord_status] || STATUS.offline;
      btn.innerHTML = `<img class="nav-dc-ava" src="${avatarUrl(state.discord_user)}" alt="Discord" referrerpolicy="no-referrer"><span class="nav-dc-dot" style="background:${s.c}"></span>`;
      btn.classList.add("has-ava");
    }
    // else: leave the default Discord logo that's already in the button
  }

  async function poll() {
    if (!ID) { renderCard({ error: true }); return; }
    try {
      const r = await fetch("https://api.lanyard.rest/v1/users/" + ID, { cache: "no-store" });
      const j = await r.json();
      if (j && j.success && j.data) {
        monitored = true; lastData = j.data;
        renderCard(j.data); updateNav(j.data);
        return;
      }
    } catch (e) {}
    monitored = false;
    renderCard({ error: true });
  }

  window.AW3Discord = { poll, refresh: poll, isMonitored: () => monitored, data: () => lastData };

  // initial paint (fallback) so the card is never empty, then live data
  renderCard({ error: true });
  poll();
  setInterval(poll, 30000); // refresh status every 30s
})();
