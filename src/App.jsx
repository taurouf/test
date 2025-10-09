import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

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
  { value: "takeaway", label: "À emporter" },
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
   Utils
   ========================= */
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

// Hash SHA-256 (hex) pour la passphrase (fallback local)
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* =========================
   Composant
   ========================= */
function App() {
  /* ——— Passphrase lock ——— */
  const [unlocked, setUnlocked] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [hasStoredHash, setHasStoredHash] = useState(false);
  const [serverAuthAvailable, setServerAuthAvailable] = useState(true); // on tentera login serveur d’abord

  useEffect(() => {
    const stored = localStorage.getItem("zelty_passphrase_hash");
    setHasStoredHash(!!stored);
    setUnlocked(false);
  }, []);

  // Déverrouillage : tente serveur, sinon fallback local
  async function handleUnlock() {
    const entered = passphraseInput.trim();
    if (!entered) return;

    // 1) Tentative côté serveur
    if (serverAuthAvailable) {
      try {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase: entered }),
        });
        if (r.ok) {
          setUnlocked(true);
          setStatus("🔓 Déverrouillé (serveur).");
          setPassphraseInput("");
          return;
        } else if (r.status === 404) {
          // route absente => on bascule en mode local
          setServerAuthAvailable(false);
        } else {
          setUnlocked(false);
          setStatus("❌ Passphrase invalide (serveur).");
          setPassphraseInput("");
          return;
        }
      } catch {
        // Réseau/route indispo → on bascule local
        setServerAuthAvailable(false);
      }
    }

    // 2) Fallback local (hash en localStorage)
    const enteredHash = await sha256Hex(entered);
    const stored = localStorage.getItem("zelty_passphrase_hash");

    if (stored) {
      if (enteredHash === stored) {
        setUnlocked(true);
        setStatus("🔓 Déverrouillé (local).");
      } else {
        setStatus("❌ Passphrase invalide (local).");
      }
    } else {
      localStorage.setItem("zelty_passphrase_hash", enteredHash);
      setUnlocked(true);
      setHasStoredHash(true);
      setStatus("🔐 Passphrase enregistrée localement.");
    }
    setPassphraseInput("");
  }

  function lockOut() {
    setUnlocked(false);
    setStatus("🔒 Verrouillé.");
  }

  function resetPassphrase() {
    localStorage.removeItem("zelty_passphrase_hash");
    setUnlocked(false);
    setHasStoredHash(false);
    setStatus("🔁 Passphrase réinitialisée (local).");
  }

  async function handleLogout() {
    // Si mode serveur disponible, on efface le cookie HttpOnly
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Reverrouille l’app côté front
    setUnlocked(false);
    setStatus("🔒 Déconnecté.");
  }

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

  // Verrou global des appels
  const canCall = Boolean(apiKey) && apiKey.length > 8 && unlocked;

  /* ——— Catalogues ——— */
  useEffect(() => {
    if (!canCall) return;
    (async () => {
      try {
        setStatus("Chargement des catalogues…");
        try {
          const r = await zfetch(API_BASE, "/restaurants", {
            apiKey,
            baseKey: envName,
          });
          const rs = r?.restaurants || [];
          setRestaurants(rs);
          if (rs.length === 1) setRestaurantId(String(rs[0].id));
        } catch {}
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
  }, [apiKey, envName, canCall]);

  useEffect(() => {
    if (!isAggregator && source && !LIMITED_SOURCES.includes(source)) setSource("");
  }, [isAggregator, source]);

  /* ——— Client: chargement par ID (bouton Recharger) ——— */
  async function loadCustomer() {
    if (!canCall || !customerId) {
      setStatus("🔒 Verrouillé ou ID client manquant.");
      return;
    }
    setCustomerLoading(true);
    setCustomerData(null);
    try {
      // 1) /customers/{id}
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
      } catch {
        /* fallback */
      }
      // 2) /customers?search=
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
  const findOption = (id) =>
    optionsList.find((o) => Number(o.id) === Number(id));
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
        for (const [optId, valueIdsRaw] of Object.entries(
          line.optionSelections || {}
        )) {
          const opt = findOption(optId);
          const valueIds = Array.isArray(valueIdsRaw)
            ? valueIdsRaw
            : [valueIdsRaw];
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
          for (const [optId, valIdsRaw] of Object.entries(
            choice.optionSelections || {}
          )) {
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
      if (!canCall) throw new Error("🔒 Verrouillé : saisis la passphrase.");
      if (!cart.length) throw new Error("Panier vide.");

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
        const method = txnMethods.find(
          (m) => String(m.id) === String(paymentMethodId)
        );
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
      setCart([emptyDishLine()]);
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Rendu
     ========================= */
  return (
    <div className="min-h-screen">
      {/* En-tête */}
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Zelty – Création de commande
          </h1>
          <p className="mt-2 text-white/80">
            Choisis l’environnement, puis renseigne la clé API pour charger les
            catalogues.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 -mt-6 pb-16 space-y-6">
        {/* Statut */}
        {status && (
          <div className="card px-5 py-3 border-accent/30">
            <div className="text-sm">{status}</div>
          </div>
        )}

        {/* Passphrase */}
        <section className="card p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="label">
                {serverAuthAvailable
                  ? "Passphrase (vérifiée côté serveur)"
                  : hasStoredHash
                  ? "Passphrase (mode local)"
                  : "Créer une passphrase (mode local, stockée sur cet appareil)"}
              </label>
              <input
                className="input"
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder={hasStoredHash ? "••••••••" : "Choisis une passphrase"}
              />
              <p className="muted mt-1">
                {unlocked
                  ? "Statut : déverrouillé – les appels API sont autorisés."
                  : "Statut : verrouillé – aucun appel API ne sera effectué."}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={handleUnlock}>
                {serverAuthAvailable
                  ? unlocked
                    ? "Vérifier à nouveau"
                    : "Déverrouiller"
                  : hasStoredHash
                  ? unlocked
                    ? "Vérifier à nouveau"
                    : "Déverrouiller"
                  : "Enregistrer"}
              </button>
              <button className="btn-ghost" onClick={handleLogout} disabled={!unlocked}>
                Se déconnecter
              </button>
            </div>
          </div>
        </section>

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
                disabled={!unlocked}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
              <p className="muted mt-1">
                URL cible :{" "}
                <code className="text-accent">{DISPLAY_BASES[envName]}</code>
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
                disabled={!unlocked}
              />
            </div>
            <div>
              <label className="label">Restaurant (optionnel)</label>
              <select
                className="select"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                disabled={!unlocked}
              >
                <option value="">—</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{`${r.name} (#${r.id})`}</option>
                ))}
              </select>
              <p className="muted mt-1">Auto-rempli si la clé est mono-site.</p>
            </div>
          </div>
        </section>

        {/* 2) Infos de commande */}
        <section className="card p-6">
          <h2 className="section-title">2) Informations de commande</h2>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <label className="label">Mode de consommation</label>
              <select
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={!unlocked}
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
                disabled={!unlocked}
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
                    disabled={!unlocked}
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
                disabled={!unlocked}
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
                disabled={!unlocked}
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
                    disabled={!unlocked}
                  />
                  <p className="muted mt-1">
                    Renseigne un ID pour prévisualiser le client existant ; sinon,
                    complète les champs ci-dessous pour un nouveau client.
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

        {/* Adresse livraison */}
        {mode === "delivery" && (
          <section className="card p-6">
            <h2 className="section-title">Adresse de livraison</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Nom adresse"
                v={address.name}
                set={(v) => setAddress((a) => ({ ...a, name: v }))}
              />
              <Input
                label="N° rue"
                v={address.street_num}
                set={(v) => setAddress((a) => ({ ...a, street_num: v }))}
              />
              <Input
                label="Rue"
                v={address.street}
                set={(v) => setAddress((a) => ({ ...a, street: v }))}
              />
              <Input
                label="Complément"
                v={address.address_more}
                set={(v) => setAddress((a) => ({ ...a, address_more: v }))}
              />
              <Input
                label="Code postal"
                v={address.zip_code}
                set={(v) => setAddress((a) => ({ ...a, zip_code: v }))}
              />
              <Input
                label="Ville"
                v={address.city}
                set={(v) => setAddress((a) => ({ ...a, city: v }))}
              />
              <Input
                label="Étage"
                v={address.floor}
                set={(v) => setAddress((a) => ({ ...a, floor: v }))}
              />
              <Input
                label="Porte"
                v={address.door}
                set={(v) => setAddress((a) => ({ ...a, door: v }))}
              />
              <Input
                label="Bâtiment"
                v={address.building}
                set={(v) => setAddress((a) => ({ ...a, building: v }))}
              />
              <Input
                label="Code immeuble"
                v={address.code}
                set={(v) => setAddress((a) => ({ ...a, code: v }))}
              />
            </div>
          </section>
        )}

        {/* 3) Panier */}
        <section className="card p-6">
          <h2 className="section-title">3) Panier – Produits, options guidées & menus</h2>
          <div className="space-y-4">
            {cart.map((line, idx) => {
              const setLine = (patch) => updateLine(idx, patch);
              const lineTitle =
                line.type === "menu"
                  ? findMenu(line.menuId)?.name || `Menu #${line.menuId || "—"}`
                  : findDish(line.dishId)?.name || `Produit #${line.dishId || "—"}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-primary/10 bg-white shadow-sm p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="font-semibold text-primary">{lineTitle}</div>
                    <button className="btn-ghost" onClick={() => removeLine(idx)}>
                      Supprimer
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <label className="label">Type</label>
                      <select
                        className="select"
                        value={line.type}
                        onChange={(e) => setLine({ type: e.target.value })}
                      >
                        <option value="dish">Plat</option>
                        <option value="menu">Menu</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Quantité</label>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          setLine({
                            quantity: Math.max(1, Number(e.target.value || 1)),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">
                        {line.type === "menu" ? "Menu" : "Plat"}
                      </label>
                      {line.type === "menu" ? (
                        <select
                          className="select"
                          value={line.menuId}
                          onChange={(e) =>
                            setLine({ menuId: e.target.value, menuChoices: {} })
                          }
                        >
                          <option value="">—</option>
                          {menus.map((m) => (
                            <option key={m.id} value={m.id}>{`${m.name} (#${m.id})`}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className="select"
                          value={line.dishId}
                          onChange={(e) =>
                            setLine({ dishId: e.target.value, optionSelections: {} })
                          }
                        >
                          <option value="">—</option>
                          {dishes.map((d) => (
                            <option key={d.id} value={d.id}>{`${d.name} (#${d.id})`}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Options pour plat */}
                  {line.type === "dish" && line.dishId && (
                    <details className="mt-4 rounded-xl border border-primary/10 px-4 py-3">
                      <summary className="font-medium">Options</summary>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {(optionsList || [])
                          .filter(
                            (o) =>
                              (findDish(line.dishId)?.options || []).includes(o.id)
                          )
                          .map((opt) => {
                            const isMulti = Boolean(opt.multi);
                            const current = Array.isArray(
                              line.optionSelections?.[opt.id]
                            )
                              ? line.optionSelections[opt.id]
                              : line.optionSelections?.[opt.id]
                              ? [line.optionSelections[opt.id]]
                              : [];
                            return (
                              <details
                                key={opt.id}
                                className="rounded-xl border border-primary/10 p-3"
                              >
                                <summary className="text-sm">{`${opt.name} (#${opt.id})${
                                  current.length ? ` — ${current.length}` : ""
                                }`}</summary>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(opt.values || []).map((v) => {
                                    const checked = current.includes(String(v.id));
                                    return (
                                      <label key={v.id} className="chip">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            const now = Array.isArray(
                                              line.optionSelections?.[opt.id]
                                            )
                                              ? line.optionSelections[opt.id]
                                              : [];
                                            const next = e.target.checked
                                              ? isMulti
                                                ? [...now, String(v.id)]
                                                : [String(v.id)]
                                              : now.filter((x) => x !== String(v.id));
                                            updateLine(idx, {
                                              optionSelections: {
                                                ...(line.optionSelections || {}),
                                                [opt.id]: next,
                                              },
                                            });
                                          }}
                                        />
                                        {v.name}{" "}
                                        {v.price
                                          ? `(+${(v.price / 100).toFixed(2)}€)`
                                          : ""}
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
                  {line.type === "menu" && line.menuId && (
                    <div className="mt-4 space-y-3">
                      {(findMenu(line.menuId)?.parts || []).map((p) => {
                        const choice = line.menuChoices?.[p.id] || {};
                        const setChoice = (patch) =>
                          updateLine(idx, {
                            menuChoices: {
                              ...(line.menuChoices || {}),
                              [p.id]: { ...(line.menuChoices?.[p.id] || {}), ...patch },
                            },
                          });

                        return (
                          <div
                            key={p.id}
                            className="rounded-2xl border border-primary/10 p-3"
                          >
                            <div className="font-medium">
                              {p.name} (part #{p.id})
                            </div>
                            <div className="mt-2">
                              <label className="label">Choix</label>
                              <select
                                className="select"
                                value={choice.dishId || ""}
                                onChange={(e) =>
                                  setChoice({
                                    dishId: e.target.value,
                                    optionSelections: {},
                                  })
                                }
                              >
                                <option value="">—</option>
                                {(p.dishes || []).map((dId) => {
                                  const d = findDish(dId);
                                  return (
                                    <option key={dId} value={dId}>
                                      {d ? `${d.name} (#${d.id})` : `Plat #${dId}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {choice.dishId && (
                              <details className="mt-3 rounded-xl border border-primary/10 px-3 py-2">
                                <summary className="text-sm">Options</summary>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(optionsList || [])
                                    .filter(
                                      (o) =>
                                        (findDish(choice.dishId)?.options || []).includes(
                                          o.id
                                        )
                                    )
                                    .map((opt) => {
                                      const current = Array.isArray(
                                        choice.optionSelections?.[opt.id]
                                      )
                                        ? choice.optionSelections[opt.id]
                                        : [];
                                      return (
                                        <details
                                          key={opt.id}
                                          className="rounded-2xl border border-primary/10 p-3"
                                        >
                                          <summary className="text-sm">{`${
                                            opt.name
                                          } (#${opt.id})${
                                            current.length ? ` — ${current.length}` : ""
                                          }`}</summary>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {(opt.values || []).map((v) => {
                                              const checked = current.includes(
                                                String(v.id)
                                              );
                                              return (
                                                <label key={v.id} className="chip">
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                      const now = Array.isArray(
                                                        choice.optionSelections?.[opt.id]
                                                      )
                                                        ? choice.optionSelections[opt.id]
                                                        : [];
                                                      const next = e.target.checked
                                                        ? [...now, String(v.id)]
                                                        : now.filter(
                                                            (x) => x !== String(v.id)
                                                          );
                                                      setChoice({
                                                        optionSelections: {
                                                          ...(choice.optionSelections ||
                                                            {}),
                                                          [opt.id]: next,
                                                        },
                                                      });
                                                    }}
                                                  />
                                                  {v.name}{" "}
                                                  {v.price
                                                    ? `(+${(v.price / 100).toFixed(2)}€)`
                                                    : ""}
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
              <button className="btn-accent" onClick={addDishLine}>
                + Ajouter un plat
              </button>
              <button className="btn-accent" onClick={addMenuLine}>
                + Ajouter un menu
              </button>
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
              <button
                type="button"
                className="btn-ghost"
                onClick={() => console.log("DEBUG payload:", payload)}
              >
                🧪 Debug console
              </button>
              <button
                type="button"
                className="btn-success"
                disabled={loading || !canCall}
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
      </main>
    </div>
  );
}

/* Petit helper input */
function Input({ label, v, set, ...rest }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input mt-1"
        value={v}
        onChange={(e) => set(e.target.value)}
        {...rest}
      />
    </label>
  );
}

export default App;
