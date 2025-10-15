// /api/zelty/proxy.js
export const config = { runtime: "nodejs" };

const BASES = {
  production: "https://api.zelty.fr/2.10",
  staging:    "https://api.staging.zelty.co/2.10",
};

function hasAuthCookie(req) {
  const cookie = req.headers.cookie || "";
  return cookie.split(/;\s*/).some((c) => c.startsWith("zelty_auth=ok"));
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || "";
  const m = cookie.split(/;\s*/).find((c) => c.startsWith(name + "="));
  if (!m) return null;
  try {
    return decodeURIComponent(m.split("=").slice(1).join("="));
  } catch {
    return null;
  }
}

function stripTrailingSlash(s) {
  return s.replace(/\/+$/, "");
}

function getRestPath(req) {
  // Ex: /api/zelty/catalog/dishes?lang=fr -> /catalog/dishes?lang=fr
  const url = req.url || "";
  const idx = url.indexOf("/api/zelty");
  const suffix = idx >= 0 ? url.slice(idx + "/api/zelty".length) : url;
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
}

function getRawBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve(null);
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export default async function handler(req, res) {
  try {
    if (!hasAuthCookie(req)) {
      return res.status(401).json({ error: "Unauthorized: missing cookie (zelty_auth)" });
    }

    const baseKey = String(req.headers["x-zelty-base"] || "production").toLowerCase();
    const base = BASES[baseKey] || BASES.production;

    const restPath = getRestPath(req); // ex: /restaurants   | /catalog/dishes?lang=fr
    const target = stripTrailingSlash(base) + restPath;

    // Forward headers vers Zelty
    const fwd = new Headers();
    if (req.headers.authorization)    fwd.set("Authorization", req.headers.authorization);
    if (req.headers["content-type"])  fwd.set("Content-Type", req.headers["content-type"]);
    if (req.headers.accept)           fwd.set("Accept", req.headers.accept);
    if (req.headers["accept-language"]) fwd.set("Accept-Language", req.headers["accept-language"]);

    let body = await getRawBody(req);

    /* ==========
       WHITELIST stricte :
       - cookie HttpOnly "wl_by_env" : { production: [..], staging: [..] }
       - compat: cookie "wl" simple => même liste pour tous les env
       - si la liste de l'env courant est VIDE => on BLOQUE
       - pour POST /orders : on lit id_restaurant dans le body
       ========== */
    if (req.method === "POST" && restPath.startsWith("/orders")) {
      try {
        const wlEnvRaw = getCookie(req, "wl_by_env");
        let wlByEnv = null;
        if (wlEnvRaw) {
          try { wlByEnv = JSON.parse(wlEnvRaw); } catch {}
        }
        // compat cookie simple
        let wl = null;
        if (!wlByEnv) {
          const wlRaw = getCookie(req, "wl");
          if (wlRaw) {
            try { wl = JSON.parse(wlRaw); } catch { wl = []; }
          }
        }

        const ids = Array.isArray(wlByEnv?.[baseKey])
          ? wlByEnv[baseKey]
          : Array.isArray(wl) ? wl : [];

        // si vide => blocage total
        if (!ids.length) {
          return res
            .status(403)
            .json({ ok: false, error: "No restaurant allowed for this environment (whitelist empty)." });
        }

        // lire id_restaurant
        const txt = body ? body.toString("utf8") : "{}";
        const json = JSON.parse(txt || "{}");
        const idRestaurant = Number(json?.id_restaurant);
        if (!ids.includes(idRestaurant)) {
          return res
            .status(403)
            .json({ ok: false, error: "Restaurant not allowed (whitelist)." });
        }
        // réinjecter le buffer intact
        body = Buffer.from(txt, "utf8");
      } catch (e) {
        res.setHeader("X-Whitelist-Check", "parse_error");
      }
    }

    let upstream;
    try {
      upstream = await fetch(target, { method: req.method, headers: fwd, body });
    } catch (e) {
      res.setHeader("X-Proxy-Target", target);
      return res.status(502).json({ error: "Bad Gateway", detail: String(e) });
    }

    res.setHeader("X-Proxy-Target", target);
    const ct = upstream.headers.get("content-type") || "application/json";
    res.setHeader("Content-Type", ct);

    if (upstream.status === 204) return res.status(204).end();

    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (e) {
    console.error("proxy error:", e);
    return res.status(500).json({ error: "proxy_internal", detail: String(e) });
  }
}