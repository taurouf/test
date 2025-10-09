// /api/zelty/[...path].js

// Choix des bases Zelty selon l'en-tête X-Zelty-Base
const BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

function hasAuthCookie(req) {
  const cookie = req.headers.cookie || "";
  return cookie.split(/;\s*/).some((c) => c.startsWith("zelty_auth=ok"));
}

// Lit le corps brut (utile pour POST/PUT/PATCH)
function getRawBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve(null);
    let data = [];
    req.on("data", (c) => data.push(c));
    req.on("end", () => resolve(Buffer.concat(data)));
  });
}

export default async function handler(req, res) {
  // Gate: refuse si pas authentifié via /api/auth/login
  if (!hasAuthCookie(req)) {
    return res
      .status(401)
      .json({ error: "Unauthorized: missing or invalid cookie (zelty_auth)" });
  }

  // Base (prod/staging) pilotée par l'en-tête custom
  const baseKey = String(req.headers["x-zelty-base"] || "production").toLowerCase();
  const base = BASES[baseKey] || BASES.production;

  // Reconstruit la cible : /api/zelty/<...path>?query=...
  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const pathname = "/" + segments.join("/");

  // Recompose la querystring (sauf "path")
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv));
    else if (v != null) params.set(k, String(v));
  }

  const target = `${base}${pathname}${params.toString() ? "?" + params.toString() : ""}`;

  // Prépare les en-têtes à forwarder
  const fwdHeaders = new Headers();
  // Autorisation Zelty (Bearer)
  if (req.headers.authorization) fwdHeaders.set("Authorization", req.headers.authorization);
  // Type de contenu si présent
  if (req.headers["content-type"]) fwdHeaders.set("Content-Type", req.headers["content-type"]);
  // Langue & accept facultatifs
  if (req.headers["accept"]) fwdHeaders.set("Accept", req.headers["accept"]);
  if (req.headers["accept-language"])
    fwdHeaders.set("Accept-Language", req.headers["accept-language"]);

  // Corps
  const rawBody = await getRawBody(req);

  // Appel à l'API Zelty
  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: fwdHeaders,
      body: rawBody,
    });
  } catch (e) {
    return res.status(502).json({ error: "Bad Gateway", detail: String(e) });
  }

  // Récupère réponse Zelty et la renvoie telle quelle
  const contentType = upstream.headers.get("content-type") || "";
  const status = upstream.status;

  // Copie quelques en-têtes utiles (pas tous)
  res.setHeader("Content-Type", contentType);
  // Optionnel : exposer la cible pour debug (à retirer si non souhaité)
  res.setHeader("X-Proxy-Target", target);

  if (status === 204) {
    return res.status(204).end();
  }

  const text = await upstream.text();
  return res.status(status).send(text);
}
