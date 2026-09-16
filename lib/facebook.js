const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = "v25.0"; // v23.0 reached end-of-life June 2026 — bump this periodically

export async function getFacebookViewers() {
  if (!PAGE_ID || !PAGE_TOKEN) {
    return { count: null, live: false, error: "missing_credentials" };
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/live_videos?broadcast_status=["LIVE"]&fields=id,live_views&access_token=${PAGE_TOKEN}`;
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
