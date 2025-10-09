// /api/auth/debug-hash.js  (à supprimer après debug)
export default async function handler(req, res) {
  const body = await new Promise((resolve) => {
    if (req.method !== "POST") return resolve({});
    if (typeof req.body === "object" && req.body !== null) return resolve(req.body);
    let raw = ""; req.on("data", c => raw += c); req.on("end", () => {
      try { resolve(JSON.parse(raw||"{}")); } catch { resolve({}); }
    });
  });
  const pass = (body.passphrase || "").trim();
  const crypto = await import("node:crypto");
  const calc = crypto.createHash("sha256").update(pass).digest("hex");
  const expected = (process.env.PASS_HASH || "").trim();
  res.status(200).json({ calc, expected, match: calc === expected });
}
