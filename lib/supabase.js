import { createClient } from "@supabase/supabase-js";

let client = null;

function getClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }
    // Service role key — server-only, bypasses RLS. Never expose this to the browser.
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Small key-value helper backed by a single `kv_store` table (key text pk,
// value jsonb, updated_at timestamptz). Supabase/Postgres has no native key
// TTL like Redis, so "expiry" is emulated by checking `updated_at` age at
// read time via the optional `maxAgeSeconds` option.

export async function kvGet(key, { maxAgeSeconds } = {}) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("kv_store")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  if (!data) return null;

  if (maxAgeSeconds != null) {
    const ageMs = Date.now() - new Date(data.updated_at).getTime();
    if (ageMs > maxAgeSeconds * 1000) return null; // stale — treat as expired
  }

  return data.value;
}

export async function kvSet(key, value) {
  const supabase = getClient();
  const { error } = await supabase
    .from("kv_store")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

export async function kvDel(key) {
  const supabase = getClient();
  const { error } = await supabase.from("kv_store").delete().eq("key", key);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}
