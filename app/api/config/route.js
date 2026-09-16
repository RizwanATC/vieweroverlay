import { NextResponse } from "next/server";
import {
  getYoutubeConfig,
  saveYoutubeConfig,
  testYoutubeCredentials,
} from "@/lib/youtube";
import {
  getFacebookConfig,
  saveFacebookConfig,
  testFacebookCredentials,
} from "@/lib/facebook";
import { parseYoutubeInput, parseFacebookInput } from "@/lib/parseIdentifiers";

export const dynamic = "force-dynamic";

function isAuthorized(req) {
  const password = process.env.SETUP_PASSWORD;
  // Fail closed: if no password is set, nobody can read or change config —
  // set SETUP_PASSWORD before using /setup.
  if (!password) return false;
  return req.headers.get("x-setup-password") === password;
}

export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [yt, fb] = await Promise.allSettled([getYoutubeConfig(), getFacebookConfig()]);
  const y = yt.status === "fulfilled" ? yt.value : {};
  const f = fb.status === "fulfilled" ? fb.value : {};

  // Never echo the actual secret values back — just enough to show "is this set?".
  return NextResponse.json({
    youtube: {
      configured: Boolean(y.apiKey && (y.handle || y.channelId)),
      handle: y.handle || null,
      channelId: y.channelId || null,
    },
    facebook: {
      configured: Boolean(f.pageId && f.pageToken),
      pageId: f.pageId || null,
    },
  });
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    if (body.platform === "youtube") {
      const parsed = parseYoutubeInput(body.urlOrHandle);
      const result = await testYoutubeCredentials({ apiKey: body.apiKey, ...parsed });
      await saveYoutubeConfig({
        apiKey: body.apiKey,
        handle: parsed.handle || null,
        channelId: result.channelId,
      });
      return NextResponse.json({ ok: true, name: result.title, channelId: result.channelId });
    }

    if (body.platform === "facebook") {
      const parsed = parseFacebookInput(body.urlOrPageId);
      const result = await testFacebookCredentials({
        pageId: parsed.pageId,
        pageToken: body.pageToken,
      });
      await saveFacebookConfig({ pageId: result.pageId, pageToken: body.pageToken });
      return NextResponse.json({ ok: true, name: result.name, pageId: result.pageId });
    }

    return NextResponse.json({ error: "unknown platform" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
