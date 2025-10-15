// /api/_lib/whitelist.js
export const config = { runtime: "nodejs" };

const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

function must(v, name) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
const BASE = must(KV_REST_API_URL, "KV_REST_API_URL");
const TOKEN = must(KV_REST_API_TOKEN, "KV_REST_API_TOKEN");

export async function readWhitelist(env) {
  const key = `wl_by_env:${env}`;
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`KV get ${key} => ${r.status}`);
  const js = await r.json();
  const raw = js.result ?? "";
  const list = String(raw)
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isFinite(n));
  return list;
}

export async function writeWhitelist(env, ids) {
  const key = `wl_by_env:${env}`;
  const value = (ids ?? []).join("\n");
  const r = await fetch(`${BASE}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV set ${key} => ${r.status}`);
  return true;
}

export function envFromReq(req) {
  // priorité au query ?env=..., puis cookie w1_by_env, sinon APP_ENV, sinon "production"
  const q = new URL(req.url, "http://x").searchParams.get("env");
  if (q) return q;
  const ck = req.headers.cookie || "";
  const w = ck.split(/;\s*/).find(c => c.startsWith("w1_by_env="));
  if (w) return decodeURIComponent(w.split("=")[1]);
  return process.env.APP_ENV || "production";
}