// /api/admin/whitelist.js
import { readWhitelist, writeWhitelist, envFromReq } from "../_lib/whitelist.js";

export const config = { runtime: "nodejs" };

function ensureLogged(req) {
  const ck = req.headers.cookie || "";
  const ok = ck.split(/;\s*/).some(c => c.trim() === "zelty_auth=ok");
  if (!ok) {
    const e = new Error("UNAUTHORIZED");
    e.code = 401;
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    ensureLogged(req);
    const env = envFromReq(req);

    if (req.method === "GET") {
      const list = await readWhitelist(env);
      // On synchronise aussi un cookie env utilisé côté serveur
      res.setHeader("Set-Cookie", `w1_by_env=${encodeURIComponent(env)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      return res.json({ ok: true, env, ids: list });
    }

    if (req.method === "PUT") {
      const body = await getBody(req);
      const raw = String(body?.ids ?? "");
      const ids = raw
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => Number.isFinite(n));
      await writeWhitelist(env, ids);
      res.setHeader("Set-Cookie", `w1_by_env=${encodeURIComponent(env)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      return res.json({ ok: true, saved: ids.length });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (e) {
    const code = e.code || 500;
    return res.status(code).json({ ok: false, error: String(e.message || e) });
  }
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}