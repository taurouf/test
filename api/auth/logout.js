// /api/auth/logout.js
export default async function handler(req, res) {
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const cookie =
    "zelty_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
    (isProd ? "; Secure" : "");

  res.setHeader("Set-Cookie", cookie);
  res.json({ ok: true });
}
