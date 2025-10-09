const BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

function hasAuthCookie(req) {
  const cookie = req.headers.cookie || "";
  return cookie.split(/;\s*/).some((c) => c.startsWith("zelty_auth=ok"));
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
  if (!hasAuthCookie(req)) {
    return res
      .status(401)
      .json({ error: "Unauthorized: missing or invalid cookie (zelty_auth)" });
  }

  const baseKey = String(req.headers["x-zelty-base"] || "production").toLowerCase();
  const base = BASES[baseKey] || BASES.production;

  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean);
  const pathname = "/" + segments.join("/");

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv));
    else if (v != null) params.set(k, String(v));
  }

  const target = `${base}${pathname}${params.toString() ? "?" + params.toString() : ""}`;

  const fwd = new Headers();
  if (req.headers.authorization) fwd.set("Authorization", req.headers.authorization);
  if (req.headers["content-type"]) fwd.set("Content-Type", req.headers["content-type"]);
  if (req.headers.accept) fwd.set("Accept", req.headers.accept);
  if (req.headers["accept-language"]) fwd.set("Accept-Language", req.headers["accept-language"]);

  const body = await getRawBody(req);

  let upstream;
  try {
    upstream = await fetch(target, { method: req.method, headers: fwd, body });
  } catch (e) {
    return res.status(502).json({ error: "Bad Gateway", detail: String(e) });
  }

  const contentType = upstream.headers.get("content-type") || "application/json";
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Proxy-Target", target);

  if (upstream.status === 204) return res.status(204).end();

  const text = await upstream.text();
  return res.status(upstream.status).send(text);
}
