# Anime Warriors III — Secret Calculator

Calculator + Gem Clicker + **global leaderboard** + shared community board, with **real
server-side accounts**, **anti-cheat**, and **per-account save sync** (your clicker progress
follows your account across devices). One small Node process serves the site *and* the API.

```
aw3-site/
├─ package.json       ← Render uses this (root) to build & start the server
├─ render.yaml        ← Render deploy blueprint
├─ public/            ← the website (static files)
│  ├─ index.html
│  ├─ config.js       ← ★ EDIT THIS: API URL, Discord, credits
│  ├─ api.js  auth.js  clicker.js  comments.js  leaderboard.js  credits.js  discord.js
│  ├─ app.js  particles.js  settings.js  styles.css
│  └─ images (hero.jpg, bg.jpg, unit_*.png)
└─ server/
   ├─ server.js       ← accounts, leaderboard, comments, clicker sync, anti-cheat
   ├─ package.json
   └─ .env.example
```

---

## 1. Run it locally (2 minutes)

Needs **Node 18+** ([nodejs.org](https://nodejs.org)). From the project root:

```bash
npm install
npm start          # → http://localhost:8080
```

Data is saved to `server/data.json`. Done — sign up and play.

---

## 2. Put it online (so other people can use it)

The site and API ship together, so any Node host works. **Render** has a free tier and reads
the included `render.yaml`:

1. Put these files in a **GitHub** repo. **Important:** `package.json` and `render.yaml`
   must sit at the **repository root** — not inside a sub-folder. (If you upload the
   `aw3-site` folder itself, open it first and upload its *contents* so the root is correct.)
2. Render → **New + → Blueprint** → pick the repo → **Apply**.
   It sets the build/start commands and generates `JWT_SECRET` for you.
3. **Make data persist (important on the free plan):** the free disk is wiped on every
   redeploy, so use a free **Upstash Redis** database:
   - [upstash.com](https://upstash.com) → create a free Redis DB → copy its
     **REST URL** and **REST TOKEN**.
   - Paste them into the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars
     Render asks for. That's it — accounts, leaderboard, clicker saves and posts now persist.
   - *(Skip this only if you're on a paid plan with a mounted disk, in which case set
     `DATA_FILE` to a path on that disk instead.)*
4. Open your live URL: `https://your-app.onrender.com`.

> Railway / Fly.io / a small VPS work the same way: `npm install`, `npm start`, set
> `JWT_SECRET`, and either set the Upstash vars or point `DATA_FILE` at persistent storage.

### Hosting the frontend separately (optional)
To put `public/` on Netlify/Vercel/GitHub Pages and run only the API elsewhere:
- set `API_BASE` in `public/config.js` to your API URL;
- on the API set `ALLOWED_ORIGIN` to your site URL, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`.

---

## 3. Configure (`public/config.js`)

```js
API_BASE: ""                        // "" = same server. Else your API URL.
DISCORD_ID: "1209319851533930558"   // your Discord — profile + live status use this
DISCORD_INVITE: ""                  // optional server invite (overrides the profile link)
SITE_AUTHOR: "woko"                 // shown in Credits
FORMULA_AUTHORS: "spliax & xtermiz"
```

---

## 4. Show your Discord avatar + live status

The Credits panel (and the nav button) show your **avatar** and **online / idle / DnD / offline**
status in real time. This is powered by **Lanyard**, which can only read your presence once you
join its Discord **one time** with the same account:

1. Join **https://discord.gg/lanyard** (you can leave later, but staying keeps it live).
2. That's it — the card auto-updates every ~30s. Until you join, it shows a "Live status off"
   fallback with a link to your profile.

No bot, no token, nothing to host. Status colors: 🟢 online · 🟡 idle · 🔴 DnD · ⚪ offline.

---

## 5. What saves, and the anti-cheat

**Saves (per account, synced to the server):** clicker gems, generators, upgrades, Star Shards,
achievements and clicks. Log in on another device and your progress is there. (Logged out / no
backend → it still saves locally in that browser.)

**Anti-cheat** — the server is the source of truth for the leaderboard and checks every score:
- login required; sessions are signed JWTs in an httpOnly cookie (JS can't read/forge them);
- junk numbers (`1e308`, NaN) rejected outright;
- **wall-clock rate cap** — gems can't grow faster than the game can produce in the real time
  that passed, so the classic *"set gems to 1e300 in the console"* cheat is rejected;
- monotonic + no "ratcheting" (a flagged submit never advances the trusted baseline);
- Star Shards bounded by lifetime gems; rate-limits; 3 flags → hidden from the board;
- passwords bcrypt-hashed server-side; posts length-capped and HTML-escaped.

**Honest limit:** no browser idle game is 100% uncheatable — the game runs on the player's
machine. These rules kill essentially all casual cheating. Tunables live in the `AC` object at
the top of `server/server.js`.

---

## 6. Demo mode

Open the site with no backend reachable and it falls back to **local mode** (accounts,
leaderboard and board live in your browser) so the UI always works. The global, cheat-resistant,
synced features turn on once the backend is running.
