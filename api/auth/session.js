// api/auth/session.js
export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  try {
    const cookie = req.headers.cookie || "";
    const authorized = cookie.split(/;\s*/).some(c => c.startsWith("zelty_auth=ok"));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ authorized });
  } catch (e) {
    return res.status(200).json({ authorized: false });
  }
}
