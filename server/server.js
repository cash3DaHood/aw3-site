/* ============================================================
   Anime Warriors III — Secret Calculator  ·  backend
   Serves the static site + accounts + leaderboard + community +
   per-account clicker save sync, with server-side anti-cheat.

   Storage (pick one, auto-detected):
     • Upstash Redis  → set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
                        (free + persistent — survives on free hosts like Render free)
     • JSON file      → default (DATA_FILE), great for local + hosts with a disk
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ---------------- config ---------------- */
const PORT = process.env.PORT || 8080;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const COOKIE_NAME = "aw3_token";
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || "lax";
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL = "30d";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);
const REDIS_KEY = "aw3:db";

/* ---------------- storage ---------------- */
function freshDB() { return { users: {}, comments: null, version: 1 }; }
let db = freshDB();

async function redisCmd(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}

async function loadDB() {
  if (USE_REDIS) {
    try {
      const v = await redisCmd(["GET", REDIS_KEY]);
      if (v) db = Object.assign(freshDB(), JSON.parse(v));
      console.log("Storage: Upstash Redis");
    } catch (e) { console.error("Redis load failed:", e.message); }
  } else {
    try {
      if (fs.existsSync(DATA_FILE)) db = Object.assign(freshDB(), JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
      console.log("Storage: JSON file (" + DATA_FILE + ")");
    } catch (e) { console.error("Could not read data file, starting fresh:", e.message); }
  }
}

let saveTimer = null, saving = false;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (saving) { persist(); return; }
    saving = true;
    try {
      if (USE_REDIS) {
        await redisCmd(["SET", REDIS_KEY, JSON.stringify(db)]);
      } else {
        const tmp = DATA_FILE + ".tmp";
        await fs.promises.writeFile(tmp, JSON.stringify(db));
        await fs.promises.rename(tmp, DATA_FILE);
      }
    } catch (e) { console.error("persist failed:", e.message); }
    finally { saving = false; }
  }, 400);
}

function seedComments() {
  if (db.comments) return;
  const now = Date.now(), H = 3600e3;
  db.comments = [
    { id: "s1", author: "spliax",  cat: "tip",   text: "Push Secret Chance hard before dumping into luck — luck soft-caps at the 14 − Star breakpoint (×0.05 above it), so raw Secret Chance keeps scaling when luck stops.", ts: now - 26 * H, voters: { xtermiz: 1, akira: 1, momo: 1 } },
    { id: "s2", author: "xtermiz", cat: "comp",  text: "Solid F2P secret-farm comp: Broly (front DPS) + Minato (atk-speed support) + Mihawk (AoE clear). Keep Minato's buff on Broly and let Mihawk wipe waves while you idle opens.", ts: now - 13 * H, voters: { spliax: 1, momo: 1 } },
    { id: "s3", author: "spliax",  cat: "relic", text: "Relic Open Speed is the single biggest grind multiplier in the calc — prioritize it over flat fast-open % once you're past ~100% GP.", ts: now - 5 * H, voters: { xtermiz: 1 } },
    { id: "s4", author: "akira",   cat: "comp",  text: "Naruto (Beast) carries late if you can afford the stars — pair with Vegito for the burst window. Rotate ults on the boss bar.", ts: now - 90 * 60e3, voters: {} },
  ];
  persist();
}

/* ============================================================
   ANTI-CHEAT  — the server bounds every leaderboard score by what
   is physically possible in the real time that passed. A console
   edit like st.gems = 1e308 is rejected; the trusted baseline never
   advances on a flagged submit, so cheaters can't ratchet up either.
   (Per-account clicker SAVES below are the player's own data and only
   affect their own game — the leaderboard is validated separately.)
   ============================================================ */
const AC = { MAX_NUM: 1e30, BASE_RATE_CEIL: 1e8, SHARD_BONUS: 0.02, ACH_MAX: 1.4, FRENZY: 7, FUDGE: 2.5, FLOOR: 1e4 };
function maxRate(shards) {
  const s = Math.max(0, Math.min(shards || 0, 1e6));
  return AC.BASE_RATE_CEIL * (1 + s * AC.SHARD_BONUS) * AC.ACH_MAX * AC.FRENZY;
}
const isNum = (v) => typeof v === "number" && isFinite(v);

/* ---------------- auth helpers ---------------- */
function setSession(res, username) {
  const token = jwt.sign({ u: username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: 30 * 24 * 3600 * 1000, path: "/" });
}
function clearSession(res) { res.clearCookie(COOKIE_NAME, { path: "/", sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE }); }
function currentUser(req) {
  const t = req.cookies && req.cookies[COOKIE_NAME];
  if (!t) return null;
  try { const { u } = jwt.verify(t, JWT_SECRET); return db.users[u] ? u : null; } catch (e) { return null; }
}
function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in." });
  req.username = u;
  next();
}

/* ---------------- app ---------------- */
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(cors({ origin: ALLOWED_ORIGIN || true, credentials: true }));

const limiterGlobal = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
const limiterAuth = rateLimit({ windowMs: 15 * 60_000, max: 40, message: { error: "Too many attempts, slow down." } });
const limiterPost = rateLimit({ windowMs: 60_000, max: 8, message: { error: "You're posting too fast." } });
const limiterScore = rateLimit({ windowMs: 60_000, max: 40 });
app.use("/api/", limiterGlobal);

app.get("/api/health", (req, res) => res.json({ ok: true, storage: USE_REDIS ? "redis" : "file", time: Date.now() }));

/* ---------------- auth ---------------- */
function validUsername(u) {
  u = (u || "").trim();
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 20) return "Username too long (max 20).";
  if (!/^[A-Za-z0-9_]+$/.test(u)) return "Use letters, numbers and _ only.";
  return null;
}
app.post("/api/auth/signup", limiterAuth, async (req, res) => {
  const { username, password } = req.body || {};
  const err = validUsername(username);
  if (err) return res.status(400).json({ error: err });
  if ((password || "").length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const key = username.trim();
  if (Object.keys(db.users).some((u) => u.toLowerCase() === key.toLowerCase()))
    return res.status(409).json({ error: "That username is already taken." });
  const hash = await bcrypt.hash(password, 10);
  db.users[key] = { hash, created: Date.now(), bestGems: 0, bestShards: 0, bestClicks: 0, lastLife: 0, lastScoreTs: Date.now(), flags: 0, scoreUpdated: 0, clicker: null };
  persist(); setSession(res, key); res.json({ username: key });
});
app.post("/api/auth/login", limiterAuth, async (req, res) => {
  const { username, password } = req.body || {};
  const key = Object.keys(db.users).find((u) => u.toLowerCase() === (username || "").trim().toLowerCase());
  if (!key) return res.status(401).json({ error: "No account with that username." });
  const ok = await bcrypt.compare(password || "", db.users[key].hash);
  if (!ok) return res.status(401).json({ error: "Incorrect password." });
  setSession(res, key); res.json({ username: key });
});
app.post("/api/auth/logout", (req, res) => { clearSession(res); res.json({ ok: true }); });
app.get("/api/auth/me", (req, res) => res.json({ username: currentUser(req) }));

/* ---------------- leaderboard ---------------- */
app.get("/api/leaderboard", (req, res) => {
  const metric = req.query.metric === "shards" ? "shards" : "gems";
  const rows = Object.entries(db.users)
    .filter(([, u]) => u.flags < 3 && (u.bestGems > 0 || u.bestShards > 0))
    .map(([name, u]) => ({ username: name, gems: u.bestGems, shards: u.bestShards, clicks: u.bestClicks, updated: u.scoreUpdated }))
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 100)
    .map((r, i) => ({ rank: i + 1, ...r }));
  res.json({ metric, rows });
});
app.post("/api/score", limiterScore, requireAuth, (req, res) => {
  const u = db.users[req.username];
  let { life, shards, clicks } = req.body || {};
  if (!isNum(life) || !isNum(shards) || !isNum(clicks)) return res.status(400).json({ error: "Bad payload." });
  life = Math.max(0, life); shards = Math.max(0, Math.floor(shards)); clicks = Math.max(0, Math.floor(clicks));
  if (life > AC.MAX_NUM || shards > 1e6 || clicks > AC.MAX_NUM) return res.status(400).json({ error: "Out of range." });
  const now = Date.now();
  const elapsed = Math.max(1, (now - (u.lastScoreTs || u.created || now)) / 1000);
  const allowed = (u.lastLife || 0) + maxRate(shards) * elapsed * AC.FUDGE + AC.FLOOR;
  const shardCap = Math.floor(Math.sqrt(Math.max(life, u.bestGems) / 1e6)) + 3;
  if (life > allowed || shards > shardCap) {
    u.flags = (u.flags || 0) + 1; u.lastScoreTs = now; persist();
    return res.status(202).json({ accepted: false, reason: "implausible", best: { gems: u.bestGems, shards: u.bestShards } });
  }
  u.lastLife = life; u.lastScoreTs = now;
  let improved = false;
  if (life > u.bestGems) { u.bestGems = life; improved = true; }
  if (shards > u.bestShards) { u.bestShards = shards; improved = true; }
  if (clicks > u.bestClicks) u.bestClicks = clicks;
  if (improved) u.scoreUpdated = now;
  persist();
  res.json({ accepted: true, improved, best: { gems: u.bestGems, shards: u.bestShards, clicks: u.bestClicks } });
});

/* ---------------- clicker save sync (per account) ---------------- */
app.get("/api/clicker", requireAuth, (req, res) => res.json({ save: db.users[req.username].clicker || null }));
app.post("/api/clicker", requireAuth, (req, res) => {
  const save = (req.body || {}).save;
  if (save == null || typeof save !== "object") return res.status(400).json({ error: "Bad save." });
  const str = JSON.stringify(save);
  if (str.length > 8192) return res.status(413).json({ error: "Save too large." });
  db.users[req.username].clicker = JSON.parse(str); // store a clean copy
  persist();
  res.json({ ok: true });
});

/* ---------------- community ---------------- */
const CATS = new Set(["tip", "comp", "relic"]);
const publicComment = (c) => ({ id: c.id, author: c.author, cat: c.cat, text: c.text, ts: c.ts, votes: Object.keys(c.voters || {}).length, voters: c.voters || {} });
app.get("/api/comments", (req, res) => res.json({ items: db.comments.map(publicComment) }));
app.post("/api/comments", limiterPost, requireAuth, (req, res) => {
  let { cat, text } = req.body || {};
  cat = String(cat || "tip"); text = String(text || "").trim();
  if (!CATS.has(cat)) return res.status(400).json({ error: "Unknown category." });
  if (text.length < 4) return res.status(400).json({ error: "Write at least a few words." });
  if (text.length > 600) text = text.slice(0, 600);
  const item = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: req.username, cat, text, ts: Date.now(), voters: {} };
  db.comments.unshift(item);
  if (db.comments.length > 1000) db.comments.length = 1000;
  persist(); res.json({ item: publicComment(item) });
});
app.delete("/api/comments/:id", requireAuth, (req, res) => {
  const it = db.comments.find((c) => c.id === req.params.id);
  if (!it) return res.status(404).json({ error: "Not found." });
  if (it.author.toLowerCase() !== req.username.toLowerCase()) return res.status(403).json({ error: "Not your post." });
  db.comments = db.comments.filter((c) => c.id !== req.params.id);
  persist(); res.json({ ok: true });
});
app.post("/api/comments/:id/vote", requireAuth, (req, res) => {
  const it = db.comments.find((c) => c.id === req.params.id);
  if (!it) return res.status(404).json({ error: "Not found." });
  it.voters = it.voters || {};
  if (it.voters[req.username]) delete it.voters[req.username]; else it.voters[req.username] = 1;
  persist(); res.json({ item: publicComment(it) });
});

/* ---------------- static site ---------------- */
app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

/* ---------------- boot ---------------- */
(async () => {
  await loadDB();
  seedComments();
  app.listen(PORT, () => {
    console.log(`AW3 server running on http://localhost:${PORT}`);
    if (!process.env.JWT_SECRET) console.warn("⚠  JWT_SECRET not set — sessions reset on restart. Set it in production.");
  });
})();
