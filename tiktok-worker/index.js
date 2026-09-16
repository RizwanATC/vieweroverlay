import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import { Redis } from "@upstash/redis";

const USERNAME = process.env.TIKTOK_USERNAME;
const VIEWER_COUNT_KEY = "tiktok:viewerCount";
const VIEWER_COUNT_TTL_SECONDS = 30; // if we stop writing, the overlay falls back to "offline" within 30s
const RETRY_DELAY_MS = 30000;

if (!USERNAME) {
  console.error("Missing TIKTOK_USERNAME env var");
  process.exit(1);
}
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const connectionOptions = {};
if (process.env.EULERSTREAM_API_KEY) {
  // Optional: raises the free Euler Stream sign-server rate limit. https://www.eulerstream.com/
  connectionOptions.signApiKey = process.env.EULERSTREAM_API_KEY;
}

const connection = new TikTokLiveConnection(USERNAME, connectionOptions);

connection.on(WebcastEvent.ROOM_USER, async (data) => {
  // NOTE: this payload is the raw WebcastRoomUserSeqMessage proto. `total` is the
  // current concurrent viewer count; `totalUser` is cumulative unique viewers since
  // the stream started (always climbing) — verified empirically against a live room.
  if (typeof data.total !== "number") return;
  try {
    await redis.set(VIEWER_COUNT_KEY, data.total, { ex: VIEWER_COUNT_TTL_SECONDS });
  } catch (err) {
    console.error("Failed to write viewer count to Redis:", err.message);
  }
});

connection.on(ControlEvent.DISCONNECTED, ({ code, reason } = {}) => {
  console.log(`Disconnected from @${USERNAME}'s room${reason ? `: ${reason}` : ""} (code ${code})`);
});

connection.on(WebcastEvent.STREAM_END, () => {
  console.log(`@${USERNAME} ended the stream.`);
});

connection.on(ControlEvent.ERROR, (err) => {
  console.error("Connection error:", err?.message ?? err);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForDisconnect() {
  return new Promise((resolve) => {
    connection.once(ControlEvent.DISCONNECTED, resolve);
    connection.once(WebcastEvent.STREAM_END, resolve);
  });
}

async function connectLoop() {
  for (;;) {
    try {
      const state = await connection.connect();
      console.log(`Connected to roomId ${state.roomId} for @${USERNAME}`);
      await waitForDisconnect();
    } catch (err) {
      console.log(`@${USERNAME} is not live yet (${err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    }
    await sleep(RETRY_DELAY_MS);
  }
}

connectLoop();

process.on("SIGTERM", () => {
  connection.disconnect();
  process.exit(0);
});
