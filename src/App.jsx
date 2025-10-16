import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";

import "./index.css";

/* ===========================
   Modal réutilisable
   =========================== */
function Modal({ open, onClose, title, children, kind = "info" }) {
  if (!open) return null;
  const styles = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  }[kind] || "bg-white text-slate-800 ring-slate-200";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={`w-full max-w-lg rounded-2xl ring-1 ${styles} shadow-xl`}>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="grow">
              <h3 className="font-semibold text-lg">{title}</h3>
              <div className="mt-2 text-[15px] leading-relaxed">{children}</div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-white/70 hover:bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/10"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Loader plein écran
   =========================== */
function BlockingLoader({ show, label = "Chargement…" }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-lg ring-1 ring-slate-200">
        <svg className="h-5 w-5 animate-spin text-[#082C49]" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-[#082C49] font-medium">{label}</span>
      </div>
    </div>
  );
}

/* =========================
   Constantes d'affichage
   ========================= */
const DISPLAY_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};
const API_BASE = "/api/zelty";

const MODE_OPTIONS = [
  { value: "eat_in", label: "Sur place" },
  { value: "take_away", label: "À emporter" },
  { value: "delivery", label: "Livraison" },
];

const AGG_SOURCES = [
  "pos",
  "remote",
  "web",
  "mobile",
  "kiosk",
  "bo",
  "justeat",
  "foodora",
  "ubereats",
  "glovo",
  "deliveroo",
  "order-it",
];
const LIMITED_SOURCES = ["web", "mobile", "kiosk"];

/* =========================
   Utils (fetch proxy)
   ========================= */
// —— Rate limiter global (1 requête / seconde) ——
let __rlChain = Promise.resolve();
let __rlLast = 0;
const __RL_GAP_MS = 1000; // 1s entre chaque requête

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

async function zfetch(
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
      "X-Zelty-Base": baseKey, // important pour router l'env côté proxy
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

/* =================================================================
   Page de connexion (passphrase -> /api/auth/login)
   ================================================================= */
function LoginPage() {
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

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
      navigate(from, { replace: true });
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
            Entrez votre passphrase pour accéder à l'outil.
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
            Cookie de session HttpOnly (7 jours).
          </p>
        </div>
      </div>
    </div>
  );
}

/* =======================================
   Garde d'authentification
   ======================================= */
function RequireAuth({ children }) {
  const [ok, setOk] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const j = await r.json();
        if (alive) setOk(Boolean(j.authorized));
      } catch {
        if (alive) setOk(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (ok === null) {
    return (
      <div className="min-h-screen grid place-items-center text-[#082C49]/70">
        Vérification de la session…
      </div>
    );
  }
  if (!ok) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

/* ============================================================
   PAGE ADMIN — gestion de la whitelist par environnement
   ============================================================ */
function AdminWhitelistPage() {
  const [env, setEnv] = useState("production");
  const [idsText, setIdsText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function save() {
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
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/">
              ← Retour
            </Link>
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
    </div>
  );
}

/* ============================================================
   Page principale "Création de commande"
   ============================================================ */
function OrderPage() {
  /* ——— État principal ——— */
  const [envName, setEnvName] = useState("production");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(
    "Choisis l’environnement, puis renseigne la clé API pour charger les catalogues."
  );

  const [restaurants, setRestaurants] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [optionsList, setOptionsList] = useState([]);
  const [txnMethods, setTxnMethods] = useState([]);

  const [restaurantId, setRestaurantId] = useState("");
  const [mode, setMode] = useState("eat_in");
  const [isAggregator, setIsAggregator] = useState(false);
  const [source, setSource] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [addCustomer, setAddCustomer] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerData, setCustomerData] = useState(null);

  const [address, setAddress] = useState({
    name: "",
    street: "",
    street_num: "",
    zip_code: "",
    city: "",
    address_more: "",
    floor: "",
    door: "",
    building: "",
    code: "",
  });

  const emptyDishLine = () => ({
    type: "dish",
    dishId: "",
    quantity: 1,
    optionSelections: {},
  });
  const emptyMenuLine = () => ({
    type: "menu",
    menuId: "",
    quantity: 1,
    menuChoices: {},
  });
  const [cart, setCart] = useState([emptyDishLine()]);

  const [paid, setPaid] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(false);

  // Validation de la clé API
  const [apiValid, setApiValid] = useState(false);
  // Validation/chargement
  const [validatingKey, setValidatingKey] = useState(false);
  const [wlLoading, setWlLoading] = useState(false);
  const [validatingRid, setValidatingRid] = useState(false);

  // Modale globale
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState("info");
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState(null);
  const openModal = (kind, title, content) => {
    setModalKind(kind);
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  };

  // --- Whitelist (UI) ---
  const [whitelist, setWhitelist] = useState([]);
  const [keyAllowed, setKeyAllowed] = useState(true);
  const [allowMsg, setAllowMsg] = useState("");

  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    navigate("/login", { replace: true });
  }

  const canCall = Boolean(apiKey) && apiKey.length > 8;

  /* ——— Vérification de la clé API ——— */
  useEffect(() => {
    let alive = true;
    setValidatingKey(false);
    setWlLoading(false);

    // Reset si clé vide / trop courte
    if (!canCall) {
      setApiValid(false);
      setKeyAllowed(true);
      setRestaurants([]);
      setRestaurantId("");
      setAllowMsg("");
      setStatus("Choisis l’environnement, puis renseigne la clé API pour charger les catalogues.");
      return;
    }

    (async () => {
      try {
        setValidatingKey(true);
        setStatus("Vérification de la clé API…");

        // 1) Vérifie la clé via /restaurants
        const r = await zfetch(API_BASE, "/restaurants", {
          apiKey,
          baseKey: envName,
        });
        if (!alive) return;
        const rs = r?.restaurants || [];
        setRestaurants(rs);

        // 2) Charge la whitelist AVANT de décider
        setWlLoading(true);
        let ids = [];
        try {
          const wlRes = await fetch(`/api/admin/whitelist?env=${envName}`, { cache: "no-store" });
          if (wlRes.ok) {
            const j = await wlRes.json();
            ids = Array.isArray(j.ids) ? j.ids.map(Number) : [];
          }
        } catch {}
        if (!alive) return;
        setWhitelist(ids);
        setWlLoading(false);

        // 3) Marque la clé comme "valide" (elle a bien authentifié l'API)
        setApiValid(true);

        if (rs.length === 1) {
        // —— Clé RESTAURANT : on décide tout de suite
        const rid = Number(rs[0].id);
        setRestaurantId(String(rid));
        // Synchroniser côté serveur (cookies rid/wl_ok) pour les clés mono-site
        let serverOk = true;
        try {
          await zfetch(API_BASE, "/restaurants", {
            apiKey,
            baseKey: envName,
            params: { rid },
          });
        } catch {
          serverOk = false;
        }

        if (serverOk) {
          // Le proxy a accepté => wl_ok=1 côté serveur, on déverrouille sans attendre
          setKeyAllowed(true);
          setAllowMsg("");
          setStatus("✅ Clé API valide.");
        } else {
          // Le proxy a refusé => on affiche le message et on bloque
          setKeyAllowed(false);
          setAllowMsg(
            "⚠️ La clé est valide mais le restaurant lié n’est pas autorisé à créer des commandes de test. Contactez Grégory."
          );
          setStatus("⛔ Restaurant non autorisé — chargement du catalogue annulé.");
          openModal(
            "error",
            "Restaurant non autorisé",
            <div>
              La clé renseignée est <b>valide</b> mais le restaurant lié n’est <b>pas autorisé</b> à créer des commandes de test.
              <br />Veuillez contacter <b>Grégory</b>.
            </div>
          );
        }
        } else {
          // —— Clé ENSEIGNE : on attend le choix du restaurant
          setRestaurantId("");
          setKeyAllowed(false);
          setAllowMsg("");
          setStatus("✅ Clé API valide. Sélectionne un restaurant.");
        }
      } catch (err) {
        if (!alive) return;
        setApiValid(false);
        setKeyAllowed(false);
        setRestaurants([]);
        setRestaurantId("");
        setAllowMsg("");
        setStatus("❌ Clé API invalide.");
      } finally {
        if (alive) setValidatingKey(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [apiKey, envName, canCall]);

  /* ——— Catalogues ——— */
  useEffect(() => {
    if (!apiValid || !keyAllowed) return;

    (async () => {
      try {
        setStatus("Chargement des catalogues…");
        const d = await zfetch(API_BASE, "/catalog/dishes", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 2000 },
        });
        const m = await zfetch(API_BASE, "/catalog/menus", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 1000 },
        });
        const o = await zfetch(API_BASE, "/catalog/options", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 2000 },
        });
        const t = await zfetch(API_BASE, "/transaction-methods", {
          apiKey,
          baseKey: envName,
        });
        setDishes(d?.dishes || []);
        setMenus(m?.menus || []);
        setOptionsList(o?.options || []);
        setTxnMethods(t?.transaction_methods || []);
        setStatus("✅ Catalogues chargés.");
      } catch (err) {
        setStatus(`❌ ${err.message}`);
      }
    })();
  }, [apiValid, keyAllowed, apiKey, envName]);

  // Règle “Agrégateur”
  useEffect(() => {
    if (!isAggregator && source && !LIMITED_SOURCES.includes(source)) setSource("");
  }, [isAggregator, source]);

  // Changement de restaurant => synchro serveur + décision depuis le proxy
  useEffect(() => {
    if (!restaurantId) {
      setKeyAllowed(false);
      return;
    }
    if (wlLoading) {
      // On attend d'avoir la whitelist avant de décider (évite flash)
      setKeyAllowed(false);
      setAllowMsg("");
      setStatus("Chargement des autorisations (whitelist)…");
      return;
    }

    let canceled = false;
    (async () => {
      setValidatingRid(true);
      try {
        // 1) Synchronise côté serveur (cookies rid / wl_ok)
        await zfetch(API_BASE, "/restaurants", {
          apiKey,
          baseKey: envName,
          params: { rid: restaurantId },
        });

        if (canceled) return;

        // 2) Le proxy accepte => wl_ok=1, on déverrouille immédiatement l'UI
        setKeyAllowed(true);
        setAllowMsg("");
        setStatus("✅ Restaurant autorisé.");
      } catch (e) {
        if (canceled) return;

        // 3) Le proxy refuse => on bloque et on affiche la popup
        setKeyAllowed(false);
        setAllowMsg(
          "⚠️ Ce restaurant n’est pas dans la liste autorisée pour les envois de commandes de test. Contactez Grégory."
        );
        setStatus("⛔ Restaurant non autorisé — validation serveur.");
        openModal(
          "error",
          "Restaurant non autorisé",
          <div>
            Ce restaurant n'est <b>pas autorisé</b> à recevoir des commandes de test.<br />
            Veuillez contacter <b>Grégory</b>.
          </div>
        );
        return;
      } finally {
        if (!canceled) setValidatingRid(false);
      }

      // 4) (Optionnel) Vérification locale en fallback
      const ridNum = Number(restaurantId);
      if (whitelist.length && !whitelist.includes(ridNum)) {
        setKeyAllowed(false);
        setAllowMsg(
          "⚠️ Ce restaurant n’est pas dans la liste autorisée pour les envois de commandes de test. Contactez Grégory."
        );
        setStatus("⛔ Restaurant non autorisé — (fallback local).");
      }
    })();

    return () => {
      canceled = true;
    };
  }, [restaurantId, wlLoading, apiKey, envName, whitelist]);

  /* ——— Client: chargement par ID ——— */
  async function loadCustomer() {
    if (!canCall || !customerId) {
      setStatus("🧷 Clé API manquante ou ID client vide.");
      return;
    }
    setCustomerLoading(true);
    setCustomerData(null);
    try {
      try {
        const byId = await zfetch(API_BASE, `/customers/${customerId}`, {
          apiKey,
          baseKey: envName,
        });
        if (byId?.customer?.id || byId?.id) {
          setCustomerData(byId.customer || byId);
          setStatus("✅ Client chargé.");
          return;
        }
      } catch {}
      const list = await zfetch(API_BASE, "/customers", {
        apiKey,
        baseKey: envName,
        params: { search: String(customerId), limit: 50 },
      });
      const arr = list?.customers || list || [];
      const found = arr.find((c) => String(c.id) === String(customerId));
      if (found) {
        setCustomerData(found);
        setStatus("✅ Client chargé.");
      } else {
        setStatus("❌ Client introuvable.");
      }
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setCustomerLoading(false);
    }
  }

  /* ——— Helpers ——— */
  const findDish = (id) => dishes.find((d) => Number(d.id) === Number(id));
  const findMenu = (id) => menus.find((m) => Number(m.id) === Number(id));
  const findOption = (id) => optionsList.find((o) => Number(o.id) === Number(id));
  const findOptionValue = (opt, valueId) =>
    (opt?.values || []).find((v) => Number(v.id) === Number(valueId));
  const updateLine = (i, patch) =>
    setCart((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addDishLine = () => setCart((prev) => [...prev, emptyDishLine()]);
  const addMenuLine = () => setCart((prev) => [...prev, emptyMenuLine()]);
  const removeLine = (i) => setCart((prev) => prev.filter((_, idx) => idx !== i));

  /* ——— Payload ——— */
  const payload = useMemo(() => {
    const sourceValue = isAggregator
      ? source || undefined
      : LIMITED_SOURCES.includes(source)
      ? source
      : undefined;

    const items = [];

    for (const line of cart) {
      if (line.type === "dish" && line.dishId) {
        const entry = {
          type: "dish",
          id: Number(line.dishId),
          quantity: Math.max(1, Number(line.quantity || 1)),
        };
        const modifiers = [];
        for (const [optId, valueIdsRaw] of Object.entries(line.optionSelections || {})) {
          const opt = findOption(optId);
          const valueIds = Array.isArray(valueIdsRaw) ? valueIdsRaw : [valueIdsRaw];
          valueIds.forEach((vId) => {
            const val = findOptionValue(opt, vId);
            modifiers.push({
              option_id: Number(optId),
              option_value_id: Number(vId),
              quantity: 1,
              price: val?.price ?? 0,
            });
          });
        }
        if (modifiers.length) entry.modifiers = modifiers;
        items.push(entry);
      }

      if (line.type === "menu" && line.menuId) {
        const entry = {
          type: "menu",
          id: Number(line.menuId),
          quantity: Math.max(1, Number(line.quantity || 1)),
          dishes: [],
        };
        for (const [partId, choice] of Object.entries(line.menuChoices || {})) {
          if (!choice?.dishId) continue;
          const partModifiers = [];
          for (const [optId, valIdsRaw] of Object.entries(choice.optionSelections || {})) {
            const opt = findOption(optId);
            const valIds = Array.isArray(valIdsRaw) ? valIdsRaw : [valIdsRaw];
            valIds.forEach((vId) => {
              const val = findOptionValue(opt, vId);
              partModifiers.push({
                quantity: 1,
                option_value_id: Number(vId),
                price: val?.price ?? 0,
                option_id: Number(optId),
              });
            });
          }
          entry.dishes.push({
            id_part: Number(partId),
            comment: "",
            id: Number(choice.dishId),
            ...(partModifiers.length ? { modifiers: partModifiers } : {}),
          });
        }
        items.push(entry);
      }
    }

    const p = {
      id_restaurant: restaurantId ? Number(restaurantId) : undefined,
      mode,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      source: sourceValue,
      items,
    };

    if (addCustomer && customerId) {
      p.customer = { id: Number(customerId) };
    }

    if (mode === "delivery") {
      p.address = { ...address };
      p.fulfillment_type = "deliver_by_restaurant";
    }

    return p;
  }, [
    restaurantId,
    mode,
    dueDate,
    isAggregator,
    source,
    cart,
    addCustomer,
    customerId,
    address,
    optionsList,
  ]);

  /* ——— Création commande ——— */
  async function createOrder() {
    try {
      if (!canCall) throw new Error("Saisis la clé API.");
      if (!cart.length) throw new Error("Panier vide.");
      if (!keyAllowed)
        throw new Error(
          "Restaurant non autorisé (whitelist). Contactez Grégory."
        );

      setLoading(true);
      setStatus("Création de la commande…");

      const created = await zfetch(API_BASE, "/orders", {
        apiKey,
        method: "POST",
        body: payload,
        baseKey: envName,
      });
      const order = created?.order || created;
      if (!order?.id) throw new Error("Réponse inattendue : pas d'ID de commande.");

      if (paid) {
        if (!paymentMethodId)
          throw new Error("Sélectionne une méthode de paiement.");
        const total = Number(order?.price?.final_amount_inc_tax || 0);
        const method = txnMethods.find((m) => String(m.id) === String(paymentMethodId));
        const methodName = method?.name || "CB";
        await zfetch(API_BASE, `/orders/${order.id}/transactions`, {
          apiKey,
          method: "POST",
          baseKey: envName,
          body: {
            transactions: [{ name: methodName, price: total }],
            close_if_paid: true,
          },
        });
      }

      setStatus(`✅ Commande #${order.id} créée${paid ? " et payée" : ""}.`);
      openModal(
        "success",
        "Commande créée 🎉",
        <div>
          La commande a été créée avec succès.
          <div className="mt-1 text-sm">ID : <b>{order.id}</b></div>
        </div>
      );
      setCart([emptyDishLine()]);
    } catch (err) {
      setStatus(`❌ ${err.message}`);
      openModal("error", "Erreur", <pre className="whitespace-pre-wrap text-sm">{String(err.message)}</pre>);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Zelty – Création de commande
            </h1>
            <p className="mt-2 text-white/80">
              Choisis l’environnement, puis renseigne la clé API pour charger les catalogues.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/admin/whitelist">
              Admin
            </Link>
            <button className="btn-ghost bg-white/10 hover:bg-white/20" onClick={handleLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 -mt-6 pb-16 space-y-6">
        {/* BANNIÈRE whitelist */}
        {!keyAllowed && allowMsg && (
          <div className="card px-5 py-3 border-red-200 bg-red-50 text-red-700">
            {allowMsg}
          </div>
        )}

        {/* Statut */}
        {status && (
          <div className="card px-5 py-3 border-accent/30">
            <div className="text-sm">{status}</div>
          </div>
        )}

        {/* 1) Env & Auth */}
        <section className="card p-6">
          <h2 className="section-title">1) Environnement & authentification</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="label">Environnement</label>
              <select
                className="select"
                value={envName}
                onChange={(e) => setEnvName(e.target.value)}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
              <p className="muted mt-1">
                URL cible : <code className="text-accent">{DISPLAY_BASES[envName]}</code>
              </p>
            </div>
            <div>
              <label className="label">Clé API (Bearer)</label>
              <input
                className="input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value.trim())}
                placeholder="zk_live_***"
              />
            </div>
            {apiValid && (
              <div>
                <label className="label">Restaurant (optionnel)</label>
                <select
                  className="select"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                >
                  <option value="">—</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{`${r.name} (#${r.id})`}</option>
                  ))}
                </select>
                <p className="muted mt-1">Auto-rempli si la clé est mono-site.</p>
              </div>
            )}
          </div>
        </section>

        {/* 2) Infos de commande */}
        {apiValid && keyAllowed && (
        <section className="card p-6">
          <h2 className="section-title">2) Informations de commande</h2>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <label className="label">Mode de consommation</label>
              <select
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:self-end flex items-center gap-3">
              <input
                id="agg"
                type="checkbox"
                className="h-5 w-5 accent-accent"
                checked={isAggregator}
                onChange={(e) => setIsAggregator(e.target.checked)}
              />
              <label htmlFor="agg" className="label !mb-0">
                Agrégateur ?
              </label>
            </div>

            <div>
              <label className="label">Source</label>
              {(() => {
                const sourceOptions = isAggregator ? AGG_SOURCES : LIMITED_SOURCES;
                return (
                  <select
                    className="select"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">—</option>
                    {sourceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                );
              })()}
              <p className="muted mt-1">
                {isAggregator
                  ? "Agrégateur ON : toutes les sources."
                  : "Agrégateur OFF : web | mobile | kiosk."}
              </p>
            </div>

            <div>
              <label className="label">Date/heure (due_date)</label>
              <input
                className="input"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-4 mt-6">
            <div className="flex items-center gap-3">
              <input
                id="addc"
                type="checkbox"
                className="h-5 w-5 accent-accent"
                checked={addCustomer}
                onChange={(e) => setAddCustomer(e.target.checked)}
              />
              <label htmlFor="addc" className="label !mb-0">
                Ajouter un client ?
              </label>
            </div>

            {addCustomer && (
              <>
                <div className="md:col-span-2">
                  <label className="label">ID client Zelty (optionnel)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="123456"
                  />
                  <p className="muted mt-1">
                    Renseigne un ID pour prévisualiser le client existant ; sinon, complète les
                    champs ci-dessous pour un nouveau client.
                  </p>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={loadCustomer}
                    disabled={!customerId || !canCall || customerLoading}
                  >
                    {customerLoading ? "Chargement…" : "Recharger"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Carte Client (aperçu) */}
          {addCustomer && customerData && (
            <div className="mt-4">
              <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-4">
                <h3 className="font-semibold text-primary mb-3">Client</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Nom</span>
                    <div className="font-medium">{customerData?.name || "—"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Prénom</span>
                    <div className="font-medium">{customerData?.fname || "—"}</div>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-500">Adresse</span>
                    <div className="font-medium">
                      {(() => {
                        const a = (customerData?.addresses || [])[0] || {};
                        const l1 = [a.street_num, a.street].filter(Boolean).join(" ");
                        const l2 = [a.zip_code, a.city].filter(Boolean).join(" ");
                        return l1 || l2 ? `${l1}${l1 && l2 ? ", " : ""}${l2}` : "—";
                      })()}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500">Téléphone</span>
                    <div className="font-medium">
                      {customerData?.phone || customerData?.phone2 || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Email</span>
                    <div className="font-medium">{customerData?.mail || "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Adresse livraison */}
        {apiValid && keyAllowed && mode === "delivery" && (
          <section className="card p-6">
            <h2 className="section-title">Adresse de livraison</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Nom adresse" v={address.name} set={(v) => setAddress((a) => ({ ...a, name: v }))} />
              <Input label="N° rue" v={address.street_num} set={(v) => setAddress((a) => ({ ...a, street_num: v }))} />
              <Input label="Rue" v={address.street} set={(v) => setAddress((a) => ({ ...a, street: v }))} />
              <Input label="Complément" v={address.address_more} set={(v) => setAddress((a) => ({ ...a, address_more: v }))} />
              <Input label="Code postal" v={address.zip_code} set={(v) => setAddress((a) => ({ ...a, zip_code: v }))} />
              <Input label="Ville" v={address.city} set={(v) => setAddress((a) => ({ ...a, city: v }))} />
              <Input label="Étage" v={address.floor} set={(v) => setAddress((a) => ({ ...a, floor: v }))} />
              <Input label="Porte" v={address.door} set={(v) => setAddress((a) => ({ ...a, door: v }))} />
              <Input label="Bâtiment" v={address.building} set={(v) => setAddress((a) => ({ ...a, building: v }))} />
              <Input label="Code immeuble" v={address.code} set={(v) => setAddress((a) => ({ ...a, code: v }))} />
            </div>
          </section>
        )}

        {apiValid && keyAllowed && (
          <>
            {/* 3) Panier – Produits, options & menus */}
            <section className="card p-6">
              <h2 className="section-title">3) Panier – Produits, options guidées &amp; menus</h2>
              <div className="space-y-4">
                {cart.map((line, idx) => {
                  const setLine = (patch) => setCart((p)=>p.map((l,i)=>i===idx?{...l,...patch}:l));
                  const lineTitle =
                    line.type === "menu"
                      ? findMenu(line.menuId)?.name || `Menu #${line.menuId || "—"}`
                      : findDish(line.dishId)?.name || `Produit #${line.dishId || "—"}`;

                  return (
                    <div key={idx} className="rounded-2xl border border-primary/10 bg-white shadow-sm p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="font-semibold text-primary">{lineTitle}</div>
                        <button className="btn-ghost" onClick={() => setCart((p)=>p.filter((_,i)=>i!==idx))}>
                          Supprimer
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label className="label">Type</label>
                          <select className="select" value={line.type} onChange={(e)=>setLine({type:e.target.value})}>
                            <option value="dish">Plat</option>
                            <option value="menu">Menu</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Quantité</label>
                          <input className="input" type="number" min="1" value={line.quantity}
                            onChange={(e)=>setLine({quantity: Math.max(1, Number(e.target.value||1))})}/>
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">{line.type==="menu"?"Menu":"Plat"}</label>
                          {line.type==="menu"?(
                            <select className="select" value={line.menuId}
                              onChange={(e)=>setLine({menuId:e.target.value, menuChoices:{}})}>
                              <option value="">—</option>
                              {menus.map((m)=>(<option key={m.id} value={m.id}>{`${m.name} (#${m.id})`}</option>))}
                            </select>
                          ):(
                            <select className="select" value={line.dishId}
                              onChange={(e)=>setLine({dishId:e.target.value, optionSelections:{}})}>
                              <option value="">—</option>
                              {dishes.map((d)=>(<option key={d.id} value={d.id}>{`${d.name} (#${d.id})`}</option>))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Options pour plat */}
                      {line.type==="dish" && line.dishId && (
                        <details className="mt-4 rounded-xl border border-primary/10 px-4 py-3">
                          <summary className="font-medium">Options</summary>
                          <div className="mt-3 flex flex-wrap gap-3">
                            {(optionsList||[])
                              .filter((o)=>(findDish(line.dishId)?.options||[]).includes(o.id))
                              .map((opt)=>{
                                const isMulti = Boolean(opt.multi);
                                const current = Array.isArray(line.optionSelections?.[opt.id])
                                  ? line.optionSelections[opt.id]
                                  : line.optionSelections?.[opt.id] ? [line.optionSelections[opt.id]] : [];
                                return (
                                  <details key={opt.id} className="rounded-xl border border-primary/10 p-3">
                                    <summary className="text-sm">{`${opt.name} (#${opt.id})${current.length?` — ${current.length}`:""}`}</summary>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(opt.values||[]).map((v)=>{
                                        const checked = current.includes(String(v.id));
                                        return (
                                          <label key={v.id} className="chip">
                                            <input type="checkbox" checked={checked}
                                              onChange={(e)=>{
                                                const now = Array.isArray(line.optionSelections?.[opt.id]) ? line.optionSelections[opt.id] : [];
                                                const next = e.target.checked
                                                  ? (isMulti?[...now,String(v.id)]:[String(v.id)])
                                                  : now.filter((x)=>x!==String(v.id));
                                                setCart((prev)=>prev.map((l,i)=>i===idx?{
                                                  ...l, optionSelections:{...(l.optionSelections||{}),[opt.id]:next}
                                                }:l));
                                              }}/>
                                            {v.name}{v.price?`(+${(v.price/100).toFixed(2)}€)`:""}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </details>
                                );
                              })}
                          </div>
                        </details>
                      )}

                      {/* Choix menu */}
                      {line.type==="menu" && line.menuId && (
                        <div className="mt-4 space-y-3">
                          {(findMenu(line.menuId)?.parts||[]).map((p)=>{
                            const choice = line.menuChoices?.[p.id] || {};
                            const setChoice = (patch)=>setCart((prev)=>prev.map((l,i)=>i===idx?{
                              ...l, menuChoices:{...(l.menuChoices||{}), [p.id]:{...(l.menuChoices?.[p.id]||{}),...patch}}
                            }:l));

                            return (
                              <div key={p.id} className="rounded-2xl border border-primary/10 p-3">
                                <div className="font-medium">{p.name} (part #{p.id})</div>
                                <div className="mt-2">
                                  <label className="label">Choix</label>
                                  <select className="select" value={choice.dishId||""}
                                    onChange={(e)=>setChoice({dishId:e.target.value, optionSelections:{}})}>
                                    <option value="">—</option>
                                    {(p.dishes||[]).map((dId)=>{
                                      const d = findDish(dId);
                                      return <option key={dId} value={dId}>{d?`${d.name} (#${d.id})`:`Plat #${dId}`}</option>;
                                    })}
                                  </select>
                                </div>

                                {choice.dishId && (
                                  <details className="mt-3 rounded-xl border border-primary/10 px-3 py-2">
                                    <summary className="text-sm">Options</summary>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(optionsList||[])
                                        .filter((o)=>(findDish(choice.dishId)?.options||[]).includes(o.id))
                                        .map((opt)=>{
                                          const current = Array.isArray(choice.optionSelections?.[opt.id]) ? choice.optionSelections[opt.id] : [];
                                          return (
                                            <details key={opt.id} className="rounded-2xl border border-primary/10 p-3">
                                              <summary className="text-sm">{`${opt.name} (#${opt.id})${current.length?` — ${current.length}`:""}`}</summary>
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                {(opt.values||[]).map((v)=>{
                                                  const checked = current.includes(String(v.id));
                                                  return (
                                                    <label key={v.id} className="chip">
                                                      <input type="checkbox" checked={checked}
                                                        onChange={(e)=>{
                                                          const now = Array.isArray(choice.optionSelections?.[opt.id]) ? choice.optionSelections[opt.id] : [];
                                                          const next = e.target.checked ? [...now,String(v.id)] : now.filter((x)=>x!==String(v.id));
                                                          setChoice({ optionSelections:{...(choice.optionSelections||{}), [opt.id]:next} });
                                                        }}/>
                                                      {v.name}{v.price?`(+${(v.price/100).toFixed(2)}€)`:""}
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            </details>
                                          );
                                        })}
                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-3">
                  <button className="btn-accent" onClick={addDishLine}>+ Ajouter un plat</button>
                  <button className="btn-accent" onClick={addMenuLine}>+ Ajouter un menu</button>
                </div>
              </div>
            </section>

            {/* 4) Paiement */}
            <section className="card p-6">
              <h2 className="section-title">4) Paiement</h2>
              <div className="grid gap-6 md:grid-cols-4">
                <div className="flex items-end gap-3">
                  <input
                    id="paid"
                    type="checkbox"
                    className="h-5 w-5 accent-success"
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                  />
                  <label htmlFor="paid" className="label !mb-0">
                    Commande payée ?
                  </label>
                </div>
                {paid && (
                  <div className="md:col-span-2">
                    <label className="label">Méthode de paiement</label>
                    <select
                      className="select"
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                    >
                      <option value="">—</option>
                      {txnMethods.map((m) => (
                        <option key={m.id} value={m.id}>{`${m.name} (#${m.id})`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-1 flex items-end gap-3">
                  <button type="button" className="btn-ghost" onClick={() => console.log("DEBUG payload:", payload)}>
                    🧪 Debug console
                  </button>
                  <button
                    type="button"
                    className={`btn-success ${!keyAllowed ? "opacity-60 cursor-not-allowed" : ""}`}
                    disabled={loading || !canCall || !keyAllowed}
                    title={!keyAllowed ? "Restaurant non autorisé (whitelist)." : ""}
                    onClick={createOrder}
                  >
                    {loading ? "Création…" : "🧾 Créer la commande"}
                  </button>
                </div>
              </div>

              <details className="mt-4">
                <summary>Payload (temps réel)</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 text-slate-100 text-xs">
{JSON.stringify(payload, null, 2)}
                </pre>
              </details>
            </section>
          </>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        kind={modalKind}
      >
        {modalContent}
      </Modal>
      <BlockingLoader
        show={validatingKey || validatingRid || (apiValid && wlLoading)}
        label={
          validatingKey
            ? "Vérification de la clé API…"
            : validatingRid
            ? "Validation du restaurant…"
            : "Vérification des autorisations…"
        }
      />
    </div>
  );
}

/* Petit helper input */
function Input({ label, v, set, ...rest }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input mt-1" value={v} onChange={(e) => set(e.target.value)} {...rest} />
    </label>
  );
}

/* =========================
   App racine (router)
   ========================= */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <OrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/whitelist"
          element={
            <RequireAuth>
              <AdminWhitelistPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}