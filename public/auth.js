/* ============================================================
   Auth — real server accounts when a backend is reachable,
   local-only accounts (this browser) as a fallback for demo mode.
   Public API is unchanged:
     window.Auth.current() / signup() / login() / logout() / onChange() / open()
   ============================================================ */
(function () {
  const listeners = [];
  let me = null;                 // cached current username (sync access for other modules)
  let mode = "local";            // "server" | "local"

  const emit = () => listeners.forEach((f) => { try { f(me); } catch (e) {} });

  /* ---------- local (fallback) backend ---------- */
  const UKEY = "aw3.users.v1", SKEY = "aw3.session.v1";
  const loadJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let users = loadJSON(UKEY, {});
  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const randSalt = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };

  const Local = {
    async signup(username, pw) {
      username = (username || "").trim();
      if (username.length < 3) throw new Error("Username must be at least 3 characters.");
      if (username.length > 20) throw new Error("Username too long (max 20).");
      if (!/^[A-Za-z0-9_]+$/.test(username)) throw new Error("Use letters, numbers and _ only.");
      if ((pw || "").length < 6) throw new Error("Password must be at least 6 characters.");
      if (Object.keys(users).some((u) => u.toLowerCase() === username.toLowerCase())) throw new Error("That username is already taken.");
      const salt = randSalt();
      users[username] = { salt, hash: await sha256(salt + ":" + pw), created: Date.now() };
      saveJSON(UKEY, users);
      me = username; localStorage.setItem(SKEY, me); emit(); return me;
    },
    async login(username, pw) {
      username = (username || "").trim();
      const found = Object.keys(users).find((u) => u.toLowerCase() === username.toLowerCase());
      if (!found) throw new Error("No account with that username.");
      const rec = users[found];
      if ((await sha256(rec.salt + ":" + pw)) !== rec.hash) throw new Error("Incorrect password.");
      me = found; localStorage.setItem(SKEY, me); emit(); return found;
    },
    logout() { me = null; localStorage.removeItem(SKEY); emit(); },
  };

  /* ---------- server backend ---------- */
  const Server = {
    async signup(username, pw) { me = (await window.AW3API.post("/api/auth/signup", { username, password: pw })).username; emit(); return me; },
    async login(username, pw)  { me = (await window.AW3API.post("/api/auth/login",  { username, password: pw })).username; emit(); return me; },
    async logout() { try { await window.AW3API.post("/api/auth/logout"); } catch (e) {} me = null; emit(); },
  };

  const backend = () => (mode === "server" ? Server : Local);

  /* ---------- modal ---------- */
  const modal = document.getElementById("authModal");
  let view = "login";
  function renderModal() {
    modal.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true">
      <button class="auth-close" id="authClose" aria-label="Close">&times;</button>
      <div class="auth-head">
        <div class="auth-logo">✦</div>
        <h2 id="authTitle">${view === "login" ? "Welcome back" : "Create account"}</h2>
        <p class="auth-sub">${view === "login" ? "Log in to post tips & climb the leaderboard." : "Pick a name to join the leaderboard."}</p>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab ${view === "login" ? "active" : ""}" data-view="login">Log in</button>
        <button class="auth-tab ${view === "signup" ? "active" : ""}" data-view="signup">Sign up</button>
      </div>
      <form id="authForm" class="auth-form" autocomplete="off">
        <label class="auth-field"><span>Username</span>
          <input id="authUser" type="text" maxlength="20" placeholder="e.g. spliax" required></label>
        <label class="auth-field"><span>Password</span>
          <input id="authPass" type="password" minlength="6" placeholder="6+ characters" required></label>
        <p id="authErr" class="auth-err"></p>
        <button id="authSubmit" type="submit" class="btn-primary w-full">${view === "login" ? "Log in" : "Create account"}</button>
      </form>
      <p class="auth-foot">${view === "login"
        ? `New here? <button class="auth-link" data-view="signup">Create an account</button>`
        : `Already have one? <button class="auth-link" data-view="login">Log in</button>`}</p>
      <p class="auth-note">${mode === "server"
        ? "Synced to the leaderboard — password is hashed on the server."
        : "Stored locally in your browser — no server connected."}</p>
    </div>`;
    modal.querySelector("#authClose").onclick = close;
    modal.querySelectorAll("[data-view]").forEach((b) =>
      b.addEventListener("click", () => { view = b.dataset.view; renderModal(); modal.querySelector("#authUser").focus(); }));
    modal.querySelector("#authForm").addEventListener("submit", submit);
  }
  async function submit(e) {
    e.preventDefault();
    const u = modal.querySelector("#authUser").value;
    const p = modal.querySelector("#authPass").value;
    const err = modal.querySelector("#authErr");
    const btn = modal.querySelector("#authSubmit");
    err.textContent = ""; btn.disabled = true;
    try { view === "login" ? await backend().login(u, p) : await backend().signup(u, p); close(); }
    catch (ex) { err.textContent = ex.message; }
    finally { btn.disabled = false; }
  }
  function open(v) { view = v || "login"; renderModal(); modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); setTimeout(() => { const i = modal.querySelector("#authUser"); i && i.focus(); }, 30); }
  function close() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); }
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });

  /* ---------- nav account area ---------- */
  const area = document.getElementById("authArea");
  function renderArea(user) {
    if (user) {
      area.innerHTML = `
        <div class="acct"><span class="acct-avatar">${user[0].toUpperCase()}</span><span class="acct-name" title="${user}">${user}</span></div>
        <button id="logoutBtn" class="acct-logout" title="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>`;
      area.querySelector("#logoutBtn").onclick = () => backend().logout();
    } else {
      area.innerHTML = `<button id="loginBtn" class="acct-login">Log in</button>`;
      area.querySelector("#loginBtn").onclick = () => open("login");
    }
  }

  window.Auth = {
    current: () => me,
    isOnline: () => mode === "server",
    signup: (u, p) => backend().signup(u, p),
    login: (u, p) => backend().login(u, p),
    logout: () => backend().logout(),
    open,
    onChange(cb) { listeners.push(cb); cb(me); },
  };

  listeners.push(renderArea);
  renderArea(me);

  /* ---------- pick a backend once the probe finishes ---------- */
  (async () => {
    const isOnline = await window.AW3API.ready;
    if (isOnline) {
      mode = "server";
      try { me = (await window.AW3API.get("/api/auth/me")).username || null; } catch (e) { me = null; }
    } else {
      mode = "local";
      me = localStorage.getItem(SKEY) || null;
      if (me && !users[me]) me = null;
    }
    emit();
  })();
})();
