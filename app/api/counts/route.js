import { NextResponse } from "next/server";
import { getYoutubeViewers } from "@/lib/youtube";
import { getFacebookViewers } from "@/lib/facebook";
import { getTiktokViewers } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

function settle(result) {
  return result.status === "fulfilled"
    ? result.value
    : { count: null, live: false, error: "fetch_failed" };
}

export async function GET() {
  const [youtube, facebook, tiktok] = await Promise.allSettled([
    getYoutubeViewers(),
    getFacebookViewers(),
    getTiktokViewers(),
  ]);

  return NextResponse.json(
    {
      youtube: settle(youtube),
      facebook: settle(facebook),
      tiktok: settle(tiktok),
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
