import { getRedis } from "./redis";

const VIEWER_COUNT_KEY = "tiktok:viewerCount";

// The worker (separate process, see /tiktok-worker) writes this key with a short
// TTL every time it receives a viewerCount update. If the worker or the TikTok
// LIVE session goes down, the key simply expires and we fall back to "offline".
export async function getTiktokViewers() {
  try {
    const redis = getRedis();
    const raw = await redis.get(VIEWER_COUNT_KEY);
    if (raw === null || raw === undefined) return { count: 0, live: false };
    return { count: Number(raw), live: true };
  } catch (err) {
    return { count: null, live: false, error: err.message };
  }
}
