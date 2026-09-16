import { getRedis } from "./redis";

const CONFIG_KEY = "config:youtube";
const LIVE_VIDEO_ID_KEY = "youtube:liveVideoId";
const CHANNEL_ID_KEY = "youtube:channelId";
const LIVE_VIDEO_ID_TTL_SECONDS = 3600; // safety net: force a re-resolve at least hourly

// Credentials can come from the /setup page (stored in Redis) or env vars —
// Redis wins if both are set. This lets the streamer configure everything from
// the browser without touching the Vercel dashboard.
export async function getYoutubeConfig() {
  const redis = getRedis();
  const stored = (await redis.get(CONFIG_KEY)) || {};
  return {
    apiKey: stored.apiKey || process.env.YOUTUBE_API_KEY || null,
    handle: stored.handle || process.env.YOUTUBE_HANDLE || null,
    channelId: stored.channelId || process.env.YOUTUBE_CHANNEL_ID || null,
  };
}

export async function saveYoutubeConfig({ apiKey, handle, channelId }) {
  const redis = getRedis();
  await redis.set(CONFIG_KEY, {
    apiKey: apiKey || null,
    handle: handle || null,
    channelId: channelId || null,
  });
  // Whatever was cached under the old credentials/handle is now meaningless.
  await redis.del(CHANNEL_ID_KEY);
  await redis.del(LIVE_VIDEO_ID_KEY);
}

// Resolves a handle/channelId + API key to a real channel, without touching
// the polling cache — used by /setup to validate before saving.
export async function testYoutubeCredentials({ apiKey, handle, channelId }) {
  if (!apiKey) throw new Error("API key is required");
  if (!handle && !channelId) throw new Error("Channel URL, handle, or ID is required");

  const query = channelId
    ? `id=${encodeURIComponent(channelId)}`
    : `forHandle=${encodeURIComponent(handle)}`;
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&${query}&key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const item = data.items?.[0];
  if (!item) throw new Error(`No channel found for "${channelId || handle}"`);

  return { channelId: item.id, title: item.snippet?.title };
}

async function resolveChannelId(redis, config) {
  if (config.channelId) return config.channelId;

  const cached = await redis.get(CHANNEL_ID_KEY);
  if (cached) return cached;

  const { channelId } = await testYoutubeCredentials({
    apiKey: config.apiKey,
    handle: config.handle,
  });
  await redis.set(CHANNEL_ID_KEY, channelId); // permanent — handles rarely change
  return channelId;
}

async function findLiveVideoId(redis, apiKey, channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
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

async function fetchConcurrentViewers(apiKey, videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const viewers = data.items?.[0]?.liveStreamingDetails?.concurrentViewers;
  return viewers !== undefined ? Number(viewers) : null;
}

export async function getYoutubeViewers() {
  try {
    const config = await getYoutubeConfig();
    if (!config.apiKey || (!config.handle && !config.channelId)) {
      return { count: null, live: false, error: "not_configured" };
    }

    const redis = getRedis();
    const channelId = await resolveChannelId(redis, config);

    let videoId = await redis.get(LIVE_VIDEO_ID_KEY);
    if (videoId) {
      const viewers = await fetchConcurrentViewers(config.apiKey, videoId);
      if (viewers !== null) return { count: viewers, live: true };
    }

    // Cached video isn't live anymore (or nothing cached) — re-resolve current live video.
    videoId = await findLiveVideoId(redis, config.apiKey, channelId);
    if (!videoId) return { count: 0, live: false };

    const viewers = await fetchConcurrentViewers(config.apiKey, videoId);
    return { count: viewers ?? 0, live: viewers !== null };
  } catch (err) {
    return { count: null, live: false, error: err.message };
  }
}
