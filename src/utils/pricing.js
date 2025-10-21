export function extractPriceCents(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object") {
    const keys = [
      "price_inc_tax",
      "price_inc",
      "price",
      "amount_inc_tax",
      "amount",
      "value",
      "default_price_inc_tax",
      "default_price",
    ];
    for (const key of keys) {
      if (key in value) {
        const extracted = extractPriceCents(value[key]);
        if (extracted) return extracted;
      }
    }
  }
  return 0;
}
