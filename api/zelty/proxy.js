// /api/zelty/proxy.js
export const config = { runtime: "nodejs" };

import { readWhitelist, envFromReq } from "../_lib/whitelist.js";

const BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

function cookieGet(req, name) {
  const ck = req.headers.cookie || "";
  const it = ck.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return it ? decodeURIComponent(it.split("=")[1]) : "";
}
function cookieHasAuth(req) {
  const ck = req.headers.cookie || "";
  return ck.split(/;\s*/).some((c) => c.trim() === "zelty_auth=ok");
}

function extractRestaurantId(json) {
  if (!json) return 0;
  if (Array.isArray(json.restaurants) && json.restaurants.length) {
    return Number(json.restaurants[0]?.id || json.restaurants[0]?.id_restaurant || 0);
  }
  if (Array.isArray(json.data) && json.data.length) {
    return Number(json.data[0]?.id || json.data[0]?.id_restaurant || 0);
  }
  if (json.restaurant) {
    return Number(json.restaurant.id || json.restaurant.id_restaurant || 0);
  }
  if (Array.isArray(json) && json.length) {
    return Number(json[0]?.id || json[0]?.id_restaurant || 0);
  }
  if (json.id || json.id_restaurant) {
    return Number(json.id || json.id_restaurant);
  }
  return 0;
}

export default async function handler(req, res) {
  if (!cookieHasAuth(req)) {
    return res.status(401).json({ ok: false, error: "Not logged" });
  }

  const env = envFromReq(req);
  const base = BASES[env] || BASES.production;

  const url = new URL(req.url, "http://local");

  // 1) on accepte ?path=/... OU bien /api/zelty/<...>
  let path = url.searchParams.get("path") || "";
  if (!path) {
    const pn = url.pathname; // ex: /api/zelty/restaurants
    if (pn.startsWith("/api/zelty")) {
      path = pn.slice("/api/zelty".length) || "/";
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;

  // Reconstruire la query sans notre param interne 'path'
  const sp = new URLSearchParams(url.searchParams);
  sp.delete("path");
  const query = sp.toString();
  const target = base + path + (query ? `?${query}` : "");

  // 2) Garde-whitelist : tout sauf /restaurants nécessite wl_ok=1
  if (path !== "/restaurants") {
    const wlOk = cookieGet(req, "wl_ok");
    if (wlOk !== "1") {
      return res.status(403).json({
        ok: false,
        error: "NOT_WHITELISTED",
        message:
          "Ce restaurant n'est pas autorisé à recevoir des commandes de test. Contactez Grégory.",
      });
    }
  }

  // 3) Proxy upstream
  const method = req.method;
  const headers = { "Content-Type": "application/json" };

  // On ne forward que le Bearer
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Bearer ")) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing Authorization Bearer <API_KEY>" });
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

  // 4) Cas spécial /restaurants : pose des cookies (rid, wl_ok) et 403 si mono-site non whitelisté
  if (path === "/restaurants") {
    let json = null;
    try {
      json = await upstream.json();
    } catch {
      // si pas de json, renvoyer tel quel
    }

    // Id éventuellement passé par la requête quand l'utilisateur a choisi un resto (clé enseigne)
    const selRid =
      Number(url.searchParams.get("rid")) ||
      Number(url.searchParams.get("restaurant_id")) ||
      0;

    if (upstream.ok && json) {
      // Détecter si la réponse contient plusieurs restaurants (clé enseigne)
      const arr = Array.isArray(json.restaurants) ? json.restaurants : [];
      const multi = arr.length > 1;

      // Déterminer le rid à évaluer :
      // - si le front a envoyé ?rid=... on l'utilise
      // - sinon, si un seul restaurant est retourné, on prend celui-là
      // - sinon (plusieurs restos et pas de sélection), on n'évalue pas la whitelist ici
      let rid = 0;
      if (selRid) {
        rid = selRid;
      } else if (!multi) {
        rid = extractRestaurantId(json);
      }

      let allowed = false;

      if (rid) {
        try {
          const list = await readWhitelist(env);
          allowed = list.includes(Number(rid));
        } catch {
          allowed = false;
        }
      }

      // Cookies côté serveur
      const cookies = [
        `rid=${encodeURIComponent(rid ? String(rid) : "")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
        `wl_ok=${allowed ? "1" : "0"}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
        `w1_by_env=${encodeURIComponent(env)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      ];
      res.setHeader("Set-Cookie", cookies);

      // Important :
      // - clé RESTAURANT non autorisée : on renvoie 403 pour que le front affiche la popup
      // - clé ENSEIGNE (multi) sans sélection : on NE bloque PAS ici (200), le front affichera le select
      if (rid && !allowed) {
        return res.status(403).json({
          ok: false,
          error: "NOT_WHITELISTED",
          message:
            "Ce restaurant n'est pas autorisé à recevoir des commandes de test. Contactez Grégory.",
        });
      }
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).json(json ?? { ok: upstream.ok });
  }

  // 5) Réponse standard pour les autres endpoints
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