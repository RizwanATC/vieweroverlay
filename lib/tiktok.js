import { kvGet } from "./supabase";

const VIEWER_COUNT_KEY = "tiktok:viewerCount";
const MAX_AGE_SECONDS = 30;

// The worker (separate process, see /tiktok-worker) writes this key every time
// it receives a viewer-count update. If the worker or the TikTok LIVE session
// goes down, nothing new gets written, the row goes stale past MAX_AGE_SECONDS,
// and we fall back to "offline" — no separate health check needed.
export async function getTiktokViewers() {
  try {
    const value = await kvGet(VIEWER_COUNT_KEY, { maxAgeSeconds: MAX_AGE_SECONDS });
    if (value === null || value === undefined) return { count: 0, live: false };
    return { count: Number(value), live: true };
  } catch (err) {
    return { count: null, live: false, error: err.message };
  }
}
