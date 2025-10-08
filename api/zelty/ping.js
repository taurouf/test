// api/zelty/ping.js
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zelty-Base");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify({ ok: true, runtime: process.env.VERCEL ? "vercel" : "local" }));
}
