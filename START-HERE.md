# START HERE — putting your site online

This folder is already fixed and ready. Pick ONE path.

The bug that broke your deploy: `package.json` said `node server.js`, but the
real file lives in `server/server.js`. It's corrected here, so just upload as-is.

---

## Path A — Calculator online in ~2 minutes (no accounts)  ★ easiest
The calculator + clicker work; progress saves in each player's own browser.
No global accounts/leaderboard (that needs Path B).

1. Go to  https://app.netlify.com/drop
2. Drag the **`public`** folder (inside this folder) onto the page.
3. Wait ~20 seconds → you get a live link like `https://random-name.netlify.app`.
   (Make a free account when asked so the link stays forever + you can rename it.)

Done.

---

## Path B — Full app: global accounts + leaderboard (~10 minutes)

### 1) Put the files on GitHub
1. Make a free account at  https://github.com/signup
2. New repo:  https://github.com/new  → name it `aw3-site` → **Create repository**
3. On the repo page click **Add file → Upload files**.
4. Select EVERYTHING inside this folder — the **`public`** and **`server`**
   folders PLUS `package.json`, `package-lock.json`, `render.yaml`, `README.md` —
   and drag them all in together. Click **Commit changes**.
   ✅ `package.json` must show at the TOP of the repo (not inside a sub-folder).

### 2) Get free storage so data doesn't reset (do this before step 3)
1. Sign up free at  https://console.upstash.com
2. **Create Database** (Redis) → any name → **Create**.
3. On the database page find the **REST API** box. Copy:
   - **UPSTASH_REDIS_REST_URL**   (starts with `https://`)
   - **UPSTASH_REDIS_REST_TOKEN** (a long string)
   Keep them on your clipboard / in a note.

### 3) Deploy on Render
1. Sign up free at  https://dashboard.render.com  → **"Sign in with GitHub"**.
2. Click **New +** → **Blueprint**.
3. Pick your `aw3-site` repo → **Connect**.
4. Render reads `render.yaml` and shows boxes. Paste your two Upstash values
   into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   (JWT_SECRET fills itself in.)
5. Click **Apply** / **Deploy**. Wait ~2–4 min.
6. Open your link:  `https://aw3-secret-calculator.onrender.com`

Heads up: the FREE plan sleeps after 15 min idle, so the first visit after a
nap takes ~1 minute to wake up. That's normal.

---

## Changing the credits / Discord
Edit `public/config.js` (SITE_AUTHOR, DISCORD_ID, etc.), then re-upload that one
file to GitHub. Render redeploys automatically.
