// /api/zelty/proxy.js
export const config = { runtime: "nodejs" };

import { readWhitelist, envFromReq } from "../_lib/whitelist.js";

const BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

function cookieGet(req, name) {
  const ck = req.headers.cookie || "";
  const it = ck.split(/;\s*/).find(c => c.startsWith(name + "="));
  return it ? decodeURIComponent(it.split("=")[1]) : "";
}
function cookieHasAuth(req) {
  const ck = req.headers.cookie || "";
  return ck.split(/;\s*/).some(c => c.trim() === "zelty_auth=ok");
}

export default async function handler(req, res) {
  if (!cookieHasAuth(req)) {
    return res.status(401).json({ ok: false, error: "Not logged" });
  }

  const env = envFromReq(req);
  const base = BASES[env] || BASES.production;

  // On passe le path voulu en query: ?path=/restaurants
  const url = new URL(req.url, "http://x");
  const path = url.searchParams.get("path") || "/ping";

  // Garde : tout sauf /restaurants nécessite wl_ok=1
  if (path !== "/restaurants") {
    const wlOk = cookieGet(req, "wl_ok");
    if (wlOk !== "1") {
      return res.status(403).json({
        ok: false,
        error: "NOT_WHITELISTED",
        message: "Ce restaurant n'est pas autorisé à recevoir des commandes de test. Contactez Grégory.",
      });
    }
  }

  // Proxy upstream
  const target = base + path + (url.searchParams.get("qs") || "");
  const method = req.method;
  const headers = { "Content-Type": "application/json" };

  // On forward seulement l'Authorization : Bearer <API_KEY>
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(400).json({ ok: false, error: "Missing Authorization Bearer <API_KEY>" });
  }
  headers["Authorization"] = auth;

  let body;
  if (method !== "GET" && method !== "HEAD") {
    body = await streamToString(req);
  }

  let upstream;
  try {
    upstream = await fetch(target, { method, headers, body });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Bad gateway", detail: String(e) });
  }

  // Cas spécial : /restaurants => on calcule wl et on set cookies
  if (path === "/restaurants") {
    let json;
    try {
      json = await upstream.json();
    } catch {
      json = null;
    }

    if (upstream.ok && json) {
      // Zelty renvoie typiquement { data: [ { id, name, ... } ] } ou un tableau direct
      const item = Array.isArray(json?.data) ? json.data[0]
                 : Array.isArray(json) ? json[0]
                 : json?.restaurant || json?.data || null;

      const rid = Number(item?.id || item?.id_restaurant || 0);
      let allowed = false;
      if (rid) {
        try {
          const list = await readWhitelist(env);
          allowed = list.includes(rid);
        } catch {
          allowed = false;
        }
      }
      // Cookies HttpOnly pour la suite
      const cookies = [
        `rid=${encodeURIComponent(String(rid || ""))}; Path=/; HttpOnly; SameSite=Lax`,
        `wl_ok=${allowed ? "1" : "0"}; Path=/; HttpOnly; SameSite=Lax`,
        `w1_by_env=${encodeURIComponent(env)}; Path=/; HttpOnly; SameSite=Lax`,
      ];
      res.setHeader("Set-Cookie", cookies);
      // si non autorisé : on renvoie 403 tout de suite
      if (!allowed) {
        return res.status(403).json({
          ok: false,
          error: "NOT_WHITELISTED",
          message: "Ce restaurant n'est pas autorisé à recevoir des commandes de test. Contactez Grégory.",
        });
      }
    }

    // Si on arrive ici on renvoie la réponse originale (json déjà lu)
    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).json(json ?? { ok: upstream.ok });
  }

  // Réponses standard (autres endpoints)
  res.setHeader("X-Proxy-Target", target);
  const ct = upstream.headers.get("content-type") || "application/json";
  res.setHeader("Content-Type", ct);
  if (upstream.status === 204) return res.status(204).end();
  const txt = await upstream.text();
  return res.status(upstream.status).send(txt);
}

function streamToString(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
}