"use client";

import { useState } from "react";

async function callConfigApi(method, password, body) {
  const res = await fetch("/api/config", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-setup-password": password,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function SetupPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState(null);
  const [status, setStatus] = useState(null);

  const [ytInput, setYtInput] = useState("");
  const [ytKey, setYtKey] = useState("");
  const [ytBusy, setYtBusy] = useState(false);
  const [ytMessage, setYtMessage] = useState(null);

  const [fbInput, setFbInput] = useState("");
  const [fbToken, setFbToken] = useState("");
  const [fbBusy, setFbBusy] = useState(false);
  const [fbMessage, setFbMessage] = useState(null);

  async function handleUnlock(e) {
    e.preventDefault();
    setUnlockError(null);
    try {
      const data = await callConfigApi("GET", password);
      setStatus(data);
      setUnlocked(true);
    } catch (err) {
      setUnlockError(err.message);
    }
  }

  async function handleYoutubeSubmit(e) {
    e.preventDefault();
    setYtBusy(true);
    setYtMessage(null);
    try {
      const data = await callConfigApi("POST", password, {
        platform: "youtube",
        urlOrHandle: ytInput,
        apiKey: ytKey,
      });
      setYtMessage({ type: "ok", text: `Connected — channel: "${data.name}"` });
      setStatus((s) => ({ ...s, youtube: { configured: true, handle: null, channelId: data.channelId } }));
      setYtKey("");
    } catch (err) {
      setYtMessage({ type: "error", text: err.message });
    } finally {
      setYtBusy(false);
    }
  }

  async function handleFacebookSubmit(e) {
    e.preventDefault();
    setFbBusy(true);
    setFbMessage(null);
    try {
      const data = await callConfigApi("POST", password, {
        platform: "facebook",
        urlOrPageId: fbInput,
        pageToken: fbToken,
      });
      setFbMessage({ type: "ok", text: `Connected — page: "${data.name}"` });
      setStatus((s) => ({ ...s, facebook: { configured: true, pageId: data.pageId } }));
      setFbToken("");
    } catch (err) {
      setFbMessage({ type: "error", text: err.message });
    } finally {
      setFbBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Overlay Setup</h1>
          <form onSubmit={handleUnlock} style={styles.form}>
            <label style={styles.label}>
              Setup password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                autoFocus
              />
            </label>
            {unlockError && <p style={styles.error}>{unlockError}</p>}
            <button type="submit" style={styles.button}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Overlay Setup</h1>
        <p style={styles.hint}>
          Paste your channel/page URL and API key below, then Save &amp; Start. Keys are stored
          server-side only — this page never displays a saved key back to you.
        </p>

        <section style={styles.section}>
          <h2 style={styles.h2}>
            🔴 YouTube{" "}
            {status?.youtube?.configured && <span style={styles.badgeOk}>configured</span>}
          </h2>
          <form onSubmit={handleYoutubeSubmit} style={styles.form}>
            <label style={styles.label}>
              Channel URL, @handle, or Channel ID
              <input
                type="text"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="https://youtube.com/@PAPAZA8"
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              YouTube Data API key
              <input
                type="password"
                value={ytKey}
                onChange={(e) => setYtKey(e.target.value)}
                placeholder="AIza..."
                style={styles.input}
                required
              />
            </label>
            {ytMessage && (
              <p style={ytMessage.type === "ok" ? styles.success : styles.error}>{ytMessage.text}</p>
            )}
            <button type="submit" style={styles.button} disabled={ytBusy}>
              {ytBusy ? "Checking..." : "Save & Start"}
            </button>
          </form>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>
            🔵 Facebook{" "}
            {status?.facebook?.configured && <span style={styles.badgeOk}>configured</span>}
          </h2>
          <form onSubmit={handleFacebookSubmit} style={styles.form}>
            <label style={styles.label}>
              Page URL, username, or Page ID
              <input
                type="text"
                value={fbInput}
                onChange={(e) => setFbInput(e.target.value)}
                placeholder="https://facebook.com/PAPAZA8"
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              Page access token
              <input
                type="password"
                value={fbToken}
                onChange={(e) => setFbToken(e.target.value)}
                placeholder="EAAG..."
                style={styles.input}
                required
              />
            </label>
            {fbMessage && (
              <p style={fbMessage.type === "ok" ? styles.success : styles.error}>{fbMessage.text}</p>
            )}
            <button type="submit" style={styles.button} disabled={fbBusy}>
              {fbBusy ? "Checking..." : "Save & Start"}
            </button>
          </form>
        </section>

        <p style={styles.footnote}>
          🎵 TikTok needs no key here — it's handled by the always-on worker (see{" "}
          <code>tiktok-worker/</code>), configured with just your TikTok username.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    padding: "40px 16px",
    background: "#0f1115",
    fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "#1a1d24",
    borderRadius: 12,
    padding: 28,
    color: "#e8e8e8",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  h1: { fontSize: 22, margin: "0 0 8px" },
  h2: { fontSize: 16, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 },
  hint: { fontSize: 13, color: "#9aa0aa", lineHeight: 1.5, margin: "0 0 24px" },
  section: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #2a2e37",
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#c5c9d0" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #333844",
    background: "#12141a",
    color: "#e8e8e8",
    fontSize: 14,
  },
  button: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#3d7eff",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  badgeOk: {
    fontSize: 11,
    fontWeight: 600,
    color: "#1adb6b",
    background: "rgba(26,219,107,0.12)",
    padding: "2px 8px",
    borderRadius: 999,
  },
  error: { fontSize: 13, color: "#ff6b6b", margin: 0 },
  success: { fontSize: 13, color: "#1adb6b", margin: 0 },
  footnote: { fontSize: 12, color: "#7a808c", marginTop: 24, lineHeight: 1.5 },
};
