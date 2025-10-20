let __rlChain = Promise.resolve();
let __rlLast = 0;
const __RL_GAP_MS = 1000;

function __rateLimitSchedule() {
  __rlChain = __rlChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, __rlLast + __RL_GAP_MS - now);
    if (wait) {
      await new Promise((r) => setTimeout(r, wait));
    }
    __rlLast = Date.now();
  });
  return __rlChain;
}

export async function zfetch(
  apiBase,
  path,
  { apiKey, method = "GET", body, params, baseKey = "production" } = {}
) {
  const base = (apiBase || "").replace(/\/$/, "");
  const full = path.startsWith("/") ? base + path : base + "/" + path;
  const url = new URL(full, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv));
      else url.searchParams.set(k, String(v));
    });
  }
  await __rateLimitSchedule();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey || ""}`,
      "X-Zelty-Base": baseKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}
