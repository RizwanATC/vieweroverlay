"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 15000;

const PLATFORMS = [
  { key: "youtube", label: "YouTube", icon: "🔴", color: "#FF3B3B" },
  { key: "tiktok", label: "TikTok", icon: "🎵", color: "#25F4EE" },
  { key: "facebook", label: "Facebook", icon: "🔵", color: "#4A9EFF" },
];

export default function OverlayPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/counts", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Network hiccup — keep showing the last known values.
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        html,
        body {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
      `}</style>
      <div style={styles.container}>
        {PLATFORMS.map((platform) => {
          const stat = data?.[platform.key];
          const hasCount = stat?.count !== null && stat?.count !== undefined;
          const display = hasCount ? stat.count.toLocaleString() : "—";
          const isLive = Boolean(stat?.live);

          return (
            <div
              key={platform.key}
              style={{ ...styles.row, opacity: !hasCount || isLive ? 1 : 0.5 }}
            >
              <span style={styles.icon}>{platform.icon}</span>
              <span style={styles.label}>{platform.label}</span>
              <span style={{ ...styles.count, color: platform.color }}>{display}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 16,
    width: "fit-content",
    fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: "8px 16px",
    minWidth: 220,
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  },
  icon: {
    fontSize: 20,
    width: 24,
    textAlign: "center",
  },
  label: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  count: {
    fontSize: 18,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    minWidth: 40,
    textAlign: "right",
  },
};
