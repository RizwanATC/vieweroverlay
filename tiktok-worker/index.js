import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import { createClient } from "@supabase/supabase-js";

const USERNAME = process.env.TIKTOK_USERNAME;
const VIEWER_COUNT_KEY = "tiktok:viewerCount";
// TikTok can fire roomUser events multiple times a second — we don't want to hit
// Supabase that often. Instead we keep the latest count in memory and flush it on
// an interval well inside the 30s staleness window lib/tiktok.js checks for.
const WRITE_INTERVAL_MS = 10000;
const RETRY_DELAY_MS = 30000;

if (!USERNAME) {
  console.error("Missing TIKTOK_USERNAME env var");
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let latestCount = null;

async function writeLatestCount() {
  if (latestCount === null) return;
  const { error } = await supabase
    .from("kv_store")
    .upsert(
      { key: VIEWER_COUNT_KEY, value: latestCount, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) console.error("Failed to write viewer count to Supabase:", error.message);
}

const connectionOptions = {};
if (process.env.EULERSTREAM_API_KEY) {
  // Optional: raises the free Euler Stream sign-server rate limit. https://www.eulerstream.com/
  connectionOptions.signApiKey = process.env.EULERSTREAM_API_KEY;
}

const connection = new TikTokLiveConnection(USERNAME, connectionOptions);

connection.on(WebcastEvent.ROOM_USER, (data) => {
  // NOTE: this payload is the raw WebcastRoomUserSeqMessage proto. `total` is the
  // current concurrent viewer count; `totalUser` is cumulative unique viewers since
  // the stream started (always climbing) — verified empirically against a live room.
  if (typeof data.total === "number") latestCount = data.total;
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
      latestCount = null;
      const writeTimer = setInterval(writeLatestCount, WRITE_INTERVAL_MS);
      await waitForDisconnect();
      clearInterval(writeTimer);
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
