// api/admin/whitelist.js
export default async function handler(req, res) {
  // 1) Contrôle session (même logique que tes autres routes auth)
  const sso = req.cookies["_vercel_jwt"]; // ou ton cookie de session si différent
  if (!sso) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // 2) GET → renvoie la whitelist (depuis le cookie HttpOnly)
  if (req.method === "GET") {
    try {
      const raw = req.cookies["wl"] || "[]";
      const ids = JSON.parse(raw);
      return res.status(200).json({ ok: true, ids: Array.isArray(ids) ? ids : [] });
    } catch {
      return res.status(200).json({ ok: true, ids: [] });
    }
  }

  // 3) POST → remplace la whitelist
  if (req.method === "POST") {
    try {
      const { ids } = await readJson(req);
      const norm = (Array.isArray(ids) ? ids : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x));

      // Écrit cookie HttpOnly  (7 jours)
      res.setHeader("Set-Cookie", cookieSerialize("wl", JSON.stringify(norm), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }));

      return res.status(200).json({ ok: true, saved: norm.length });
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Invalid payload" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

/* Utils */
function cookieSerialize(name, val, opts) {
  const enc = encodeURIComponent;
  let str = `${name}=${enc(val)}`;
  if (opts.maxAge) str += `; Max-Age=${opts.maxAge}`;
  if (opts.domain) str += `; Domain=${opts.domain}`;
  if (opts.path) str += `; Path=${opts.path}`;
  if (opts.expires) str += `; Expires=${opts.expires.toUTCString()}`;
  if (opts.httpOnly) str += `; HttpOnly`;
  if (opts.secure) str += `; Secure`;
  if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
  return str;
}

async function readJson(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const txt = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(txt);
}
