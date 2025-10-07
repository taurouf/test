// api/zelty.js
const ALLOWED_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

export default async function handler(req, res) {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zelty-Base, X-Zelty-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(204).end();
  }

  // Base cible (production|staging) envoyée par le front via un header
  const baseKey = (req.headers["x-zelty-base"] || "production").toString();
  const API_BASE = ALLOWED_BASES[baseKey] || ALLOWED_BASES.production;

  // Clé Zelty de l'utilisateur (l’UI l’envoie en Authorization: Bearer XXX)
  const auth =
    req.headers["authorization"] ||
    (req.headers["x-zelty-key"] && `Bearer ${req.headers["x-zelty-key"]}`);

  if (!auth) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    return res.status(401).json({ error: "Missing Authorization" });
  }

  // Recompose l’URL cible (ex: /api/zelty/orders → https://.../orders)
  const path = req.url.replace(/^\/api\/zelty/, "");
  const target = new URL(API_BASE.replace(/\/$/, "") + path);

  // Querystring
  const qs = req.query || {};
  Object.entries(qs).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => target.searchParams.append(k, x));
    else if (v != null) target.searchParams.set(k, String(v));
  });

  // Corps JSON si nécessaire
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    ? JSON.stringify(req.body || {})
    : undefined;

  // Appel Zelty
  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers: { "Content-Type": "application/json", Authorization: auth },
    body,
  });

  const text = await upstream.text();
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.status(upstream.status);
  try {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.parse(text));
  } catch {
    res.send(text);
  }
}
