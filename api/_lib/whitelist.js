// /api/_lib/whitelist.js

export const ALLOWED_ENVS = new Set(["production", "staging"]);

export function normalizeEnv(env) {
  const e = String(env || "production").toLowerCase();
  return ALLOWED_ENVS.has(e) ? e : "production";
}

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

// Fallback mémoire (utile en local ET en cas d'échec KV)
const MEMORY = globalThis.__WL__ || (globalThis.__WL__ = {});

function keyFor(env) {
  return `WL:${env}`;
}

export async function wlGet(env) {
  const e = normalizeEnv(env);
  const key = keyFor(e);

  // Pas de KV => mémoire
  if (!HAS_KV) {
    const arr = MEMORY[key];
    return Array.isArray(arr) ? arr : [];
  }

  // KV présent, mais on sécurise tout
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });

    if (!r.ok) {
      // 404/403/&co -> on ne jette pas, on renvoie liste vide
      return [];
    }
    const data = await r.json().catch(() => ({}));
    const v = data?.result ?? data?.value ?? null;

    if (!v) return [];

    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(v) ? v : [];
  } catch {
    // En cas d’erreur réseau/JSON
    return [];
  }
}

export async function wlSet(env, ids) {
  const e = normalizeEnv(env);
  const key = keyFor(e);
  const clean = (Array.isArray(ids) ? ids : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (!HAS_KV) {
    MEMORY[key] = clean;
    return clean;
  }

  try {
    const body = JSON.stringify(clean);
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body,
    });

    if (!r.ok) {
      // En cas d’échec KV on n’interrompt pas l’app
      return clean;
    }
    return clean;
  } catch {
    return clean;
  }
}

export function hasKvConfigured() {
  return HAS_KV;
}