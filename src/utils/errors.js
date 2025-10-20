export function isAggregatorSourceError(err) {
  const msg = String(err?.message || "");
  const hasInvalid = msg.includes("Invalid source");
  const hasErrno71 =
    msg.includes('"errno": 71') || msg.includes('"errno":71') || msg.includes('errno": 71');
  if (hasInvalid && hasErrno71) return true;
  try {
    const idx = msg.indexOf("{");
    if (idx >= 0) {
      const raw = msg.slice(idx);
      const obj = JSON.parse(raw);
      const out = obj?.output || obj?.context?.output || obj;
      const errno = Number(out?.errno ?? obj?.errno);
      const src = out?.errors?.source || obj?.errors?.source;
      if (errno === 71 && src === "Invalid source") return true;
    }
  } catch {}
  return false;
}
