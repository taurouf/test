import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ENV_OPTIONS = [
  { value: "staging", label: "Staging" },
  { value: "dev", label: "Dev" },
];

function AdminWhitelistPage() {
  const [env, setEnv] = useState("staging");
  const [idsText, setIdsText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    navigate("/login", { replace: true });
  }

  function parseIds(text) {
    return text
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
  }

  const envLabel = useMemo(
    () => ENV_OPTIONS.find((opt) => opt.value === env)?.label || env.toUpperCase(),
    [env]
  );

  async function load(targetEnv = env) {
    setLoading(true);
    setStatus("");
    const label = ENV_OPTIONS.find((opt) => opt.value === targetEnv)?.label || targetEnv.toUpperCase();
    try {
      const res = await fetch(`/api/admin/whitelist?env=${targetEnv}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ids = Array.isArray(data.ids) ? data.ids : [];
      setIdsText(ids.join("\n"));
      setStatus(`✅ Whitelist ${label} chargée.`);
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setStatus("");
    const label = ENV_OPTIONS.find((opt) => opt.value === env)?.label || env.toUpperCase();
    try {
      const ids = parseIds(idsText);
      const res = await fetch(`/api/admin/whitelist?env=${env}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus(`✅ Whitelist ${label} enregistrée.`);
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Admin — Whitelist {envLabel}</h1>
            <p className="mt-2 text-white/80">
              Gère les ID restaurant autorisés pour l&apos;environnement <strong>{envLabel}</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/quick">
              ← Retour
            </Link>
            <button className="btn-ghost bg-white/10 hover:bg-white/20" onClick={handleLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 -mt-6 pb-16 space-y-6">
        {status && (
          <div className="card px-5 py-3 border-accent/30">
            <div className="text-sm">{status}</div>
          </div>
        )}

        <section className="card p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="label">Environnement</label>
              <select className="select" value={env} onChange={(e) => setEnv(e.target.value)}>
                {ENV_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">IDs autorisés (un par ligne ou séparés par des virgules)</label>
              <textarea
                className="input !h-48 font-mono"
                value={idsText}
                onChange={(e) => setIdsText(e.target.value)}
                placeholder={"7326\n1234\n..."}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="btn-ghost" onClick={load} disabled={loading}>
              Recharger
            </button>
            <button className="btn-success" onClick={save} disabled={loading}>
              Enregistrer
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminWhitelistPage;
