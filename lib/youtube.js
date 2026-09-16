import { getRedis } from "./redis";

const API_KEY = process.env.YOUTUBE_API_KEY;
const HANDLE = process.env.YOUTUBE_HANDLE; // e.g. "PAPAZA8" (no leading @)
const CHANNEL_ID_ENV = process.env.YOUTUBE_CHANNEL_ID; // optional "UC..." — skips handle resolution entirely

const LIVE_VIDEO_ID_KEY = "youtube:liveVideoId";
const CHANNEL_ID_KEY = "youtube:channelId";
const LIVE_VIDEO_ID_TTL_SECONDS = 3600; // safety net: force a re-resolve at least hourly

async function resolveChannelId(redis) {
  if (CHANNEL_ID_ENV) return CHANNEL_ID_ENV;
  if (!HANDLE) throw new Error("Set YOUTUBE_CHANNEL_ID or YOUTUBE_HANDLE");

  const cached = await redis.get(CHANNEL_ID_KEY);
  if (cached) return cached;

  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
    HANDLE
  )}&key=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const channelId = data.items?.[0]?.id;
  if (!channelId) {
    throw new Error(`Could not resolve YouTube channel ID for handle "${HANDLE}"`);
  }

  await redis.set(CHANNEL_ID_KEY, channelId); // permanent — handles rarely change
  return channelId;
}

async function findLiveVideoId(redis, channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const videoId = data.items?.[0]?.id?.videoId ?? null;

  if (videoId) {
    await redis.set(LIVE_VIDEO_ID_KEY, videoId, { ex: LIVE_VIDEO_ID_TTL_SECONDS });
  } else {
    await redis.del(LIVE_VIDEO_ID_KEY);
  }
  return videoId;
}

async function fetchConcurrentViewers(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const viewers = data.items?.[0]?.liveStreamingDetails?.concurrentViewers;
  return viewers !== undefined ? Number(viewers) : null;
}

export async function getYoutubeViewers() {
  if (!API_KEY) return { count: null, live: false, error: "missing_api_key" };

  try {
    const redis = getRedis();
    const channelId = await resolveChannelId(redis);

    let videoId = await redis.get(LIVE_VIDEO_ID_KEY);

    if (videoId) {
      const viewers = await fetchConcurrentViewers(videoId);
      if (viewers !== null) return { count: viewers, live: true };
    }

    // Cached video isn't live anymore (or nothing cached) — re-resolve current live video.
    videoId = await findLiveVideoId(redis, channelId);
    if (!videoId) return { count: 0, live: false };

    const viewers = await fetchConcurrentViewers(videoId);
    return { count: viewers ?? 0, live: viewers !== null };
  } catch (err) {
    return { count: null, live: false, error: err.message };
  }
}
