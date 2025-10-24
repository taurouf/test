import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";

const PROD_ENV = "production";
const PROD_PASSWORD = "esdaMQYmRD9tmV7N";

function AdminWhitelistProdPage() {
  const [idsText, setIdsText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();

  async function forceLogout() {
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

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/admin/whitelist?env=${PROD_ENV}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ids = Array.isArray(data.ids) ? data.ids : [];
      setIdsText(ids.join("\n"));
      setStatus("✅ Whitelist Production chargée.");
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setStatus("");
    try {
      const ids = parseIds(idsText);
      const res = await fetch(`/api/admin/whitelist?env=${PROD_ENV}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("✅ Whitelist Production enregistrée.");
    } catch (e) {
      setStatus("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmPassword() {
    if (password !== PROD_PASSWORD) {
      setPasswordError("Mot de passe invalide. Vous allez être déconnecté.");
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await forceLogout();
      return;
    }
    setAuthModalOpen(false);
    setPassword("");
    setPasswordError("");
    setAuthorized(true);
  }

  useEffect(() => {
    if (authorized) {
      load();
    }
  }, [authorized]);

  useEffect(() => {
    setAuthModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Admin — Whitelist Production
            </h1>
            <p className="mt-2 text-white/80">
              Gère les ID restaurant autorisés pour l&apos;environnement <strong>Production</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/quick">
              ← Retour
            </Link>
            <button className="btn-ghost bg-white/10 hover:bg-white/20" onClick={forceLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 -mt-6 pb-16 space-y-6">
        {!authorized && (
          <div className="card px-5 py-3 border-red-200 bg-red-50 text-red-700 text-sm">
            Authentification requise pour modifier la whitelist Production.
          </div>
        )}

        {status && authorized && (
          <div className="card px-5 py-3 border-accent/30">
            <div className="text-sm">{status}</div>
          </div>
        )}

        {authorized && (
          <section className="card p-6">
            <p className="muted mb-4">
              Cette page est sécurisée. Les modifications s&apos;appliquent immédiatement à l&apos;environnement{" "}
              <strong>Production</strong>.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
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
        )}
      </main>

      <Modal
        open={authModalOpen}
        onClose={forceLogout}
        title="Accès Whitelist Production"
        kind="error"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#082C49]">
            ⚠️ Cette page permet d&apos;ajouter des restaurants dans la whitelist <strong>Production</strong>.
            Pour continuer, saisis le mot de passe d&apos;administration.
          </p>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            placeholder="Mot de passe"
            autoFocus
            disabled={!authModalOpen}
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-ghost" type="button" onClick={forceLogout}>
              Annuler
            </button>
            <button className="btn-success" type="button" onClick={confirmPassword}>
              Confirmer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminWhitelistProdPage;
