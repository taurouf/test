export default async function handler(req, res) {
  const has = Boolean(process.env.PASS_HASH && process.env.PASS_HASH.trim());
  res.status(200).json({
    ok: true,
    passHashPresent: has,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
  });
}
