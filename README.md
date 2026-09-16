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

## Environment variables (set in Vercel → Project Settings → Environment Variables)

| Variable | Where to get it |
|---|---|
| `YOUTUBE_API_KEY` | Google Cloud Console → APIs & Services → Credentials (enable "YouTube Data API v3" first) |
| `YOUTUBE_HANDLE` | Your channel handle, no `@` (e.g. `PAPAZA8`). Resolved to a channel ID once and cached in Redis — set it once, forget it. |
| `YOUTUBE_CHANNEL_ID` | Optional: skip handle resolution entirely if you already know your `UC...` ID. |
| `FACEBOOK_PAGE_ID` | Your Page's numeric ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived Page Access Token from Graph API Explorer, with `pages_read_engagement` + `pages_show_list` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash → create a free Redis database → REST API section |

The TikTok worker (`tiktok-worker/`) has its own `.env.example` — see `tiktok-worker/README.md`.

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
