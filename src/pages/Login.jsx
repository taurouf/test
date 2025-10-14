// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "Passphrase invalide");
      }
      // Cookie zelty_auth=ok posé par le serveur
      navigate("/", { replace: true });
    } catch (e) {
      setErr("Passphrase invalide.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5FAFF] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white/90 rounded-2xl shadow-xl p-8 border border-[#4CBEFA]/10">
          <h1 className="text-2xl font-semibold text-[#082C49] mb-2">Connexion</h1>
          <p className="text-sm text-[#082C49]/70 mb-6">
            Entrez votre passphrase pour accéder à la création de commande.
          </p>

          {err && (
            <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
              {err}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-[#082C49]">
              Passphrase
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-[#082C49]/15 focus:border-[#4CBEFA] focus:ring-2 focus:ring-[#4CBEFA]/30 px-3 py-2 outline-none"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="********"
                autoFocus
              />
            </label>

            <button
              type="submit"
              disabled={loading || !pass.trim()}
              className="w-full flex items-center justify-center rounded-xl bg-[#082C49] hover:bg-[#063355] text-white py-2.5 transition disabled:opacity-60"
            >
              {loading ? "Vérification..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-4 text-xs text-[#082C49]/50">
            Accès sécurisé. Cookie de session HttpOnly (7 jours).
          </p>
        </div>
      </div>
    </div>
  );
}
