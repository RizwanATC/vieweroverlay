// Accepts a pasted URL, @handle, or bare ID and extracts what the YouTube/Facebook
// APIs actually need, so the /setup form can take "whatever the user pastes."

export function parseYoutubeInput(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return {};

  const channelUrlMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (channelUrlMatch) return { channelId: channelUrlMatch[1] };

  const handleUrlMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/i);
  if (handleUrlMatch) return { handle: handleUrlMatch[1] };

  const legacyUrlMatch = trimmed.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/i);
  if (legacyUrlMatch) return { handle: legacyUrlMatch[1] };

  if (/^UC[\w-]{20,}$/.test(trimmed)) return { channelId: trimmed };

  // Bare handle, with or without a leading @
  return { handle: trimmed.replace(/^@/, "") };
}

export function parseFacebookInput(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return {};

  const profileIdMatch = trimmed.match(/[?&]id=(\d+)/);
  if (profileIdMatch) return { pageId: profileIdMatch[1] };

  const urlMatch = trimmed.match(/facebook\.com\/([^/?#]+)/i);
  if (urlMatch) return { pageId: decodeURIComponent(urlMatch[1]) };

  return { pageId: trimmed };
}
