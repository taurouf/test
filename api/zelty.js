// api/zelty.js
const ALLOWED_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zelty-Base");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(204).end();
  }

  const baseKey = (req.headers["x-zelty-base"] || "production").toString();
  const API_BASE = ALLOWED_BASES[baseKey] || ALLOWED_BASES.production;

  const auth = req.headers["authorization"];
  if (!auth) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    return res.status(401).json({ error: "Missing Authorization" });
  }

  const path = req.url.replace(/^\/api\/zelty/, "");
  const target = new URL(API_BASE.replace(/\/$/, "") + path);

  const qs = req.query || {};
  for (const [k, v] of Object.entries(qs)) {
    if (Array.isArray(v)) v.forEach((x) => target.searchParams.append(k, x));
    else if (v != null) target.searchParams.set(k, String(v));
  }

  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    ? JSON.stringify(req.body || {})
    : undefined;

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
