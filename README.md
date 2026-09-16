# Viewer Count Overlay

Live viewer-count overlay for OBS, showing YouTube, TikTok, and Facebook counts
individually (no combined total). Deployed as two pieces:

- **This Next.js app** → Vercel. Serves `/overlay` (the OBS browser source) and
  `/api/counts` (reads YouTube + Facebook live via their APIs, and reads TikTok's
  last known count from Redis).
- **`tiktok-worker/`** → a separate always-on Node process (Railway). TikTok has
  no polling API for viewer count — `tiktok-live-connector` needs a persistent
  connection, which Vercel's serverless functions can't hold. The worker connects
  once, stays connected, and writes the current viewer count to Upstash Redis on
  every update. This app's `/api/counts` just reads that value back.

```
OBS Browser Source → /overlay → /api/counts → YouTube API (direct)
                                             → Facebook Graph API (direct)
                                             → Upstash Redis ← tiktok-worker (Railway, always-on)
```

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values (see below).
2. `npm install`
3. `npm run dev` — open http://localhost:3000/overlay

## Configuring YouTube / Facebook credentials

Two ways to do this — pick one, or mix (Redis, i.e. `/setup`, always wins if both are set):

**Option A — `/setup` page (recommended, no redeploy needed to change anything).**
Visit `https://<project>.vercel.app/setup`, enter the `SETUP_PASSWORD` you set below,
paste your channel/page URL and API key/token into each form, and hit **Save & Start**.
It validates against the real API before saving, stores the result in Redis, and never
echoes the key back to the browser afterward.

**Option B — Vercel Environment Variables** (Project Settings → Environment Variables):

| Variable | Where to get it |
|---|---|
| `SETUP_PASSWORD` | Any password you choose — required for `/setup` to work at all (fails closed without it) |
| `YOUTUBE_API_KEY` | Google Cloud Console → APIs & Services → Credentials (enable "YouTube Data API v3" first) |
| `YOUTUBE_HANDLE` | Your channel handle, no `@` (e.g. `PAPAZA8`). Resolved to a channel ID once and cached in Redis. |
| `YOUTUBE_CHANNEL_ID` | Optional: skip handle resolution entirely if you already know your `UC...` ID. |
| `FACEBOOK_PAGE_ID` | Your Page's numeric ID or username |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived Page Access Token from Graph API Explorer, with `pages_read_engagement` + `pages_show_list` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash → create a free Redis database → REST API section (required either way — also used as the `/setup` config store and the TikTok worker bridge) |

The TikTok worker (`tiktok-worker/`) has its own `.env.example` — see `tiktok-worker/README.md`.
TikTok has no `/setup` form since it needs only a public username, set directly on the worker.

## Deploying

### Vercel (this app)
1. Push this repo to GitHub.
2. Import it in Vercel, framework preset "Next.js" (auto-detected).
3. Add the environment variables above in Vercel's dashboard.
4. Deploy. Your overlay is at `https://<project>.vercel.app/overlay`.

### Railway (TikTok worker)
See `tiktok-worker/README.md`.

## OBS

Add a Browser Source pointing at `https://<project>.vercel.app/overlay`.
The page background is transparent — no extra OBS chroma-key setup needed.
Suggested size: 260×220 (grows/shrinks fine; it's just three stacked pill rows).
