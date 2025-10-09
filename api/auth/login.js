// /api/auth/login.js
export const config = { runtime: "nodejs" }; // assure runtime Node

function readJson(req) {
  return new Promise((resolve) => {
    if (typeof req.body === "object" && req.body !== null) return resolve(req.body);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end("Method not allowed");
    }

    const body = await readJson(req);
    const passphrase = (body?.passphrase ?? "").toString().trim();
    if (!passphrase) return res.status(400).json({ ok: false, error: "missing passphrase" });

    const crypto = await import("node:crypto");
    const calc = crypto.createHash("sha256").update(passphrase).digest("hex");

    const expected = (process.env.PASS_HASH || "").trim();
    if (!expected) return res.status(500).json({ ok: false, error: "PASS_HASH not set" });

    if (calc !== expected) {
      // renvoie 401 avec raison (temporaire, utile debug)
      return res.status(401).json({ ok: false, reason: "hash_mismatch" });
    }

    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    const cookie = [
      "zelty_auth=ok",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=604800", // 7 jours
      isProd ? "Secure" : ""
    ].filter(Boolean).join("; ");

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("auth/login error:", e);
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
}
