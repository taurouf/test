// api/zelty/[...path].js
const ALLOWED_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

export default async function handler(req, res) {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zelty-Base");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(204).end();
  }

  // Env cible (vient du front via select)
  const baseKey = String(req.headers["x-zelty-base"] || "production");
  const API_BASE = ALLOWED_BASES[baseKey] || ALLOWED_BASES.production;

  // Auth utilisateur (input UI)
  const auth = req.headers["authorization"];
  if (!auth) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    return res.status(401).json({ error: "Missing Authorization" });
  }

  // Sous-chemin capturé par [...path] => tableau
  const pathParts = req.query.path || [];              // ex: ["restaurants"] ou ["catalog","dishes"]
  const subPath = "/" + (Array.isArray(pathParts) ? pathParts.join("/") : String(pathParts));

  // URL cible Zelty (base + sous-chemin)
  const target = new URL(API_BASE.replace(/\/$/, "") + subPath);

  // Querystring
  const qs = req.query || {};
  for (const [k, v] of Object.entries(qs)) {
    if (k === "path") continue;                        // évite de repasser le catch-all
    if (Array.isArray(v)) v.forEach(x => target.searchParams.append(k, x));
    else if (v != null) target.searchParams.set(k, String(v));
  }

  // Corps
  const hasBody = ["POST","PUT","PATCH","DELETE"].includes(req.method);
  const body = hasBody ? JSON.stringify(req.body || {}) : undefined;

  // Appel Zelty
  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers: { "Content-Type": "application/json", "Authorization": auth },
    body
  });

  const text = await upstream.text();
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.status(upstream.status);
  try { res.setHeader("Content-Type","application/json"); res.send(JSON.parse(text)); }
  catch { res.send(text); }
}
