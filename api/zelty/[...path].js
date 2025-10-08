// api/zelty/[...path].js
const ALLOWED_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

export default async function handler(req, res) {
  // CORS / préflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zelty-Base");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(204).end();
  }

  // 👉 Healthcheck accessible sans auth
  if (req.url === "/api/zelty/ping") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(JSON.stringify({ ok: true, runtime: process.env.VERCEL ? "vercel" : "local" }));
  }

  // --- À partir d'ici: auth requise ---
  const baseKey = String(req.headers["x-zelty-base"] || "production");
  const API_BASE = ALLOWED_BASES[baseKey] || ALLOWED_BASES.production;

  const auth = req.headers["authorization"];
  if (!auth) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Content-Type", "application/json");
    return res.status(401).send(JSON.stringify({ error: "Missing Authorization" }));
  }

  const segments = req.query.path || [];
  const subPath = "/" + (Array.isArray(segments) ? segments.join("/") : String(segments));
  const target = new URL(API_BASE.replace(/\/$/, "") + subPath);

  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((x) => target.searchParams.append(k, x));
    else if (v != null) target.searchParams.set(k, String(v));
  }

  const body = ["POST","PUT","PATCH","DELETE"].includes(req.method)
    ? JSON.stringify(req.body || {})
    : undefined;

  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers: { "Content-Type": "application/json", Authorization: auth },
    body
  });

  const text = await upstream.text();
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.status(upstream.status);
  try { res.setHeader("Content-Type","application/json"); res.send(JSON.parse(text)); }
  catch { res.send(text); }
}
