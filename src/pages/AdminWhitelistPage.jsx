import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";

function AdminWhitelistPage() {
  const [env, setEnv] = useState("production");
  const [idsText, setIdsText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProdPasswordModal, setShowProdPasswordModal] = useState(false);
  const [prodPassword, setProdPassword] = useState("");
  const [prodPasswordError, setProdPasswordError] = useState("");
  const navigate = useNavigate();

  const PROD_PASSWORD = "esdaMQYmRD9tmV7N";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    navigate("/login", { replace: true });
  }

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const r = await fetch(`/api/admin/whitelist?env=${env}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const ids = Array.isArray(j.ids) ? j.ids : [];
      setIdsText(ids.join("\n"));
      setStatus("✅ Whitelist chargée.");
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function performSave() {
    setLoading(true);
    setStatus("");
    try {
      const ids = idsText
        .split(/[\s,;]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n));
      const r = await fetch(`/api/admin/whitelist?env=${env}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error(await r.text());
      setStatus("✅ Whitelist enregistrée.");
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (env === "production") {
      setProdPassword("");
      setProdPasswordError("");
      setShowProdPasswordModal(true);
      return;
    }
    await performSave();
  }

  function closeProdModal() {
    setShowProdPasswordModal(false);
    setProdPassword("");
    setProdPasswordError("");
  }

  async function confirmProdPassword() {
    if (prodPassword !== PROD_PASSWORD) {
      setProdPasswordError("Mot de passe invalide.");
      return;
    }
    closeProdModal();
    await performSave();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Admin — Whitelist restaurants
            </h1>
            <p className="mt-2 text-white/80">
              Gère les ID restaurant autorisés par environnement (Production / Staging).
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
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="label">Environnement</label>
              <select className="select" value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
              <p className="muted mt-1">
                Cookie HttpOnly <code>wl_by_env</code> mis à jour côté serveur.
              </p>
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
      <Modal
        open={showProdPasswordModal}
        onClose={closeProdModal}
        title="Confirmation Production"
        kind="error"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#082C49]">
            ⚠️ Attention : vous êtes sur le point d'ajouter des IDs à la whitelist <strong>Production</strong>.
            Confirme cette action en saisissant le mot de passe.
          </p>
          <input
            type="password"
            className="input"
            value={prodPassword}
            onChange={(e) => {
              setProdPassword(e.target.value);
              setProdPasswordError("");
            }}
            placeholder="Mot de passe"
            autoFocus
          />
          {prodPasswordError && <p className="text-sm text-red-600">{prodPasswordError}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-ghost" type="button" onClick={closeProdModal}>
              Annuler
            </button>
            <button className="btn-success" type="button" onClick={confirmProdPassword}>
              Confirmer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminWhitelistPage;
