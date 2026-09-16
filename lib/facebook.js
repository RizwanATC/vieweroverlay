import { getRedis } from "./redis";

const CONFIG_KEY = "config:facebook";
const GRAPH_API_VERSION = "v25.0"; // v23.0 reached end-of-life June 2026 — bump this periodically

export async function getFacebookConfig() {
  const redis = getRedis();
  const stored = (await redis.get(CONFIG_KEY)) || {};
  return {
    pageId: stored.pageId || process.env.FACEBOOK_PAGE_ID || null,
    pageToken: stored.pageToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || null,
  };
}

export async function saveFacebookConfig({ pageId, pageToken }) {
  const redis = getRedis();
  await redis.set(CONFIG_KEY, { pageId: pageId || null, pageToken: pageToken || null });
}

// Validates a Page ID/username + token against the real Graph API — used by
// /setup before saving.
export async function testFacebookCredentials({ pageId, pageToken }) {
  if (!pageId) throw new Error("Page URL, username, or ID is required");
  if (!pageToken) throw new Error("Page access token is required");

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
    pageId
  )}?fields=id,name&access_token=${pageToken}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  return { pageId: data.id, name: data.name };
}

export async function getFacebookViewers() {
  try {
    const config = await getFacebookConfig();
    if (!config.pageId || !config.pageToken) {
      return { count: null, live: false, error: "not_configured" };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.pageId}/live_videos?broadcast_status=["LIVE"]&fields=id,live_views&access_token=${config.pageToken}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (data.error) {
      return { count: null, live: false, error: data.error.message };
    }

    const liveVideo = data.data?.[0];
    if (!liveVideo) return { count: 0, live: false };

    return { count: Number(liveVideo.live_views ?? 0), live: true };
  } catch (err) {
    return { count: null, live: false, error: err.message };
  }
}
