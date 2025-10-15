// /api/admin/whitelist.js
import { wlGet, wlSet, normalizeEnv, hasKvConfigured } from "../_lib/whitelist.js";

export const config = { runtime: "nodejs" };

const COOKIE_NAME = "wl";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 jour

function setJson(res, status, obj, extra = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  // Autorise le cookie côté même domaine
  res.setHeader("Vary", "Cookie");
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

function setWhitelistCookie(res, ids) {
  const val = encodeURIComponent(JSON.stringify(ids || []));
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function getEnvFromQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return normalizeEnv(url.searchParams.get("env"));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve({});
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function isAdmin(req) {
  const pass = req.headers["x-admin-password"];
  const expected = String(process.env.ADMIN_PASSWORD || "");
  return expected && String(pass) === expected;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const env = getEnvFromQuery(req);

    // Mode diagnostic simple : /api/admin/whitelist?diag=1
    if (url.searchParams.get("diag") === "1") {
      return setJson(res, 200, {
        ok: true,
        env,
        hasKV: hasKvConfigured(),
      });
    }

    if (req.method === "GET") {
      // Jamais d’erreur ici : wlGet renvoie [] si KV down
      const ids = await wlGet(env);
      setWhitelistCookie(res, ids); // cookie pour le proxy
      return setJson(res, 200, { ok: true, ids, env });
    }

    if (req.method === "POST") {
      if (!isAdmin(req)) {
        return setJson(res, 401, { ok: false, error: "Unauthorized (admin)" });
      }

      const body = await readBody(req);
      let current = await wlGet(env);

      if (Array.isArray(body?.ids)) {
        current = body.ids;
      } else if (Number.isFinite(Number(body?.add))) {
        const id = Number(body.add);
        current = [...new Set([...(current || []), id])];
      } else if (Number.isFinite(Number(body?.remove))) {
        const id = Number(body.remove);
        current = (current || []).filter((x) => x !== id);
      } else {
        return setJson(res, 400, { ok: false, error: "Invalid body" });
      }

      const saved = await wlSet(env, current);
      setWhitelistCookie(res, saved);
      return setJson(res, 200, { ok: true, ids: saved, env });
    }

    return setJson(res, 405, { ok: false, error: "Method Not Allowed" }, { Allow: "GET, POST" });
  } catch (e) {
    // On renvoie une erreur JSON lisible, et surtout on N'EXPOSE PAS l'exception complète
    console.error("whitelist api error:", e);
    return setJson(res, 200, { ok: false, error: "server_error" });
  }
}