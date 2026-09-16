# TikTok LIVE worker

Always-on Node process. Connects to a TikTok LIVE room via `tiktok-live-connector`
and writes the current viewer count to Upstash Redis (key `tiktok:viewerCount`,
30s TTL) on every update. The Vercel app's `/api/counts` reads that key — it
never talks to TikTok directly.

This has to run somewhere with a persistent process, which is why it's **not**
part of the Vercel deployment. Vercel serverless functions terminate after each
response; this needs a socket held open indefinitely.

If nothing is written for 30s (worker down, or the streamer isn't live), the key
expires and the overlay automatically shows TikTok as offline — no separate
health check needed.

## Local test

```bash
cd tiktok-worker
npm install
cp .env.example .env   # fill in TIKTOK_USERNAME + Upstash creds
npm start
```

## Deploy to Railway

1. Push this repo to GitHub (the whole monorepo — Vercel and Railway each only
   look at their own subdirectory).
2. In Railway: New Project → Deploy from GitHub repo → pick this repo.
3. In the new service's Settings → set **Root Directory** to `tiktok-worker`.
4. Settings → Variables → add `TIKTOK_USERNAME`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN` (same Upstash database as the Vercel app — this is
   the bridge between the two deployments).
5. Deploy. Railway runs `npm install` then `npm start` automatically (via
   `package.json`). Check the logs — you should see
   `Connected to roomId ... for @<username>` whenever the account goes live, and
   a "not live yet, retrying" message the rest of the time (this is normal, not
   an error — it just polls every 30s waiting for the next stream).

No Dockerfile needed; Railway's Nixpacks builder handles plain Node projects
automatically.
