import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import BlockingLoader from "../components/BlockingLoader.jsx";
import {
  API_BASE,
  DISPLAY_BASES,
  MODE_OPTIONS,
  AGG_SOURCES,
  LIMITED_SOURCES,
  DUMMY_ADDRESS,
} from "../utils/constants.js";
import { zfetch } from "../utils/api.js";
import { isAggregatorSourceError } from "../utils/errors.js";
import { extractPriceCents } from "../utils/pricing.js";

function OrderPage() {
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

  const [apiValid, setApiValid] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [wlLoading, setWlLoading] = useState(false);
  const [validatingRid, setValidatingRid] = useState(false);

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

  useEffect(() => {
    let alive = true;
    setValidatingKey(false);
    setWlLoading(false);

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
        setStatus("Chargement des autorisations (whitelist)…");
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

        setStatus("Vérification de la clé API…");
        const r = await zfetch(API_BASE, "/restaurants", {
          apiKey,
          baseKey: envName,
        });
        if (!alive) return;
        const rs = r?.restaurants || [];
        setRestaurants(rs);

        setApiValid(true);

        if (rs.length === 1) {
          const rid = Number(rs[0]?.id);
          const inWl = ids.includes(rid);
          setRestaurantId(String(rid));
          if (inWl) {
            setKeyAllowed(true);
            setAllowMsg("");
            setStatus("✅ Clé API valide.");
            setModalOpen(false);
            zfetch(API_BASE, "/restaurants", {
              apiKey,
              baseKey: envName,
              params: { rid },
            }).catch(() => {});
          } else {
            setKeyAllowed(false);
            setAllowMsg("⚠️ La clé est valide mais le restaurant lié n’est pas autorisé à créer des commandes de test. Contactez Grégory.");
            openModal(
              "error",
              "Restaurant non autorisé",
              <div>
                La clé renseignée est <b>valide</b> mais le restaurant lié n’est <b>pas autorisé</b> à créer des commandes de test.
                <br />Veuillez contacter <b>Grégory</b>.
              </div>
            );
            setStatus("⛔ Restaurant non autorisé — chargement du catalogue annulé.");
            zfetch(API_BASE, "/restaurants", {
              apiKey,
              baseKey: envName,
              params: { rid },
            }).catch(() => {});
          }
        } else if (rs.length > 1) {
          setApiValid(true);
          setKeyAllowed(false);
          setRestaurantId("");
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
        openModal(
          "error",
          "Clé API invalide",
          <div>
            La clé API renseignée est invalide ou n’a pas pu être vérifiée. Vérifie la valeur puis réessaie.
          </div>
        );
      } finally {
        if (alive) setValidatingKey(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [apiKey, envName, canCall]);

  useEffect(() => {
    if (!apiValid || !keyAllowed) return;

    (async () => {
      try {
        setStatus("Chargement des catalogues…");
        const d = await zfetch(API_BASE, "/catalog/dishes", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 2000, rid: restaurantId || undefined },
        });
        const m = await zfetch(API_BASE, "/catalog/menus", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 1000, rid: restaurantId || undefined },
        });
        const o = await zfetch(API_BASE, "/catalog/options", {
          apiKey,
          baseKey: envName,
          params: { lang: "fr", limit: 2000, rid: restaurantId || undefined },
        });
        const t = await zfetch(API_BASE, "/transaction-methods", {
          apiKey,
          baseKey: envName,
          params: { rid: restaurantId || undefined },
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
  }, [apiValid, keyAllowed, apiKey, envName, restaurantId]);

  useEffect(() => {
    if (!isAggregator && source && !LIMITED_SOURCES.includes(source)) setSource("");
  }, [isAggregator, source]);

  useEffect(() => {
    setModalOpen(false);
    setAllowMsg("");
    if (!restaurantId) {
      setKeyAllowed(false);
      return;
    }
    if (wlLoading) {
      setKeyAllowed(false);
      setAllowMsg("");
      setStatus("Chargement des autorisations (whitelist)…");
      return;
    }

    const okLocal = whitelist.includes(Number(restaurantId));
    if (!okLocal) {
      setKeyAllowed(false);
      setStatus("⛔ Restaurant non autorisé (whitelist locale).");
      setAllowMsg(
        "⚠️ Ce restaurant n’est pas dans la liste autorisée pour les envois de commandes de test. Contactez Grégory."
      );
      openModal(
        "error",
        "Restaurant non autorisé",
        <div>
          Ce restaurant n'est <b>pas autorisé</b> à recevoir des commandes de test.<br />
          Veuillez contacter <b>Grégory</b>.
        </div>
      );
      return;
    }
    setKeyAllowed(true);
    setStatus("✅ Restaurant autorisé.");
    setValidatingRid(true);
    zfetch(API_BASE, "/restaurants", {
      apiKey,
      baseKey: envName,
      params: { rid: restaurantId },
    })
      .catch(() => {
        console.warn("Proxy handshake failed; UI stays allowed because WL local is OK");
      })
      .finally(() => {
        setValidatingRid(false);
      });
  }, [restaurantId, wlLoading, apiKey, envName, whitelist]);

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
          params: { rid: restaurantId || undefined },
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
        params: { search: String(customerId), limit: 50, rid: restaurantId || undefined },
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

  const payload = useMemo(() => {
    const sourceValue = isAggregator
      ? source || undefined
      : LIMITED_SOURCES.includes(source)
      ? source
      : undefined;

    const items = [];
    let totalCents = 0;

    for (const line of cart) {
      if (line.type === "dish" && line.dishId) {
        const quantity = Math.max(1, Number(line.quantity || 1));
        const dishMeta = findDish(line.dishId);
        const basePrice = extractPriceCents(
          dishMeta?.price ?? dishMeta?.price_inc_tax ?? dishMeta?.default_price ?? dishMeta
        );
        totalCents += quantity * basePrice;

        const entry = {
          type: "dish",
          id: Number(line.dishId),
          quantity,
        };
        const modifiers = [];
        let modifiersSum = 0;
        for (const [optId, valueIdsRaw] of Object.entries(line.optionSelections || {})) {
          const opt = findOption(optId);
          const valueIds = Array.isArray(valueIdsRaw) ? valueIdsRaw : [valueIdsRaw];
          valueIds.forEach((vId) => {
            const val = findOptionValue(opt, vId);
            const price = Number(val?.price ?? 0);
            modifiers.push({
              option_id: Number(optId),
              option_value_id: Number(vId),
              quantity: 1,
              price,
            });
            modifiersSum += price;
          });
        }
        if (modifiers.length) entry.modifiers = modifiers;
        if (modifiersSum) totalCents += quantity * modifiersSum;
        items.push(entry);
      }

      if (line.type === "menu" && line.menuId) {
        const quantity = Math.max(1, Number(line.quantity || 1));
        const menuMeta = findMenu(line.menuId);
        const basePrice = extractPriceCents(
          menuMeta?.price ?? menuMeta?.price_inc_tax ?? menuMeta?.default_price ?? menuMeta
        );
        totalCents += quantity * basePrice;

        const entry = {
          type: "menu",
          id: Number(line.menuId),
          quantity,
          dishes: [],
        };
        for (const [partId, choice] of Object.entries(line.menuChoices || {})) {
          if (!choice?.dishId) continue;
          const partModifiers = [];
          let partModifiersSum = 0;
          for (const [optId, valIdsRaw] of Object.entries(choice.optionSelections || {})) {
            const opt = findOption(optId);
            const valIds = Array.isArray(valIdsRaw) ? valIdsRaw : [valIdsRaw];
            valIds.forEach((vId) => {
              const val = findOptionValue(opt, vId);
              const price = Number(val?.price ?? 0);
              partModifiers.push({
                quantity: 1,
                option_value_id: Number(vId),
                price,
                option_id: Number(optId),
              });
              partModifiersSum += price;
            });
          }
          entry.dishes.push({
            id_part: Number(partId),
            comment: "",
            id: Number(choice.dishId),
            ...(partModifiers.length ? { modifiers: partModifiers } : {}),
          });
          if (partModifiersSum) totalCents += quantity * partModifiersSum;
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

    if (totalCents > 0) {
      p.total = totalCents;
    }

    if (paid && paymentMethodId && totalCents > 0) {
      const method = txnMethods.find((m) => String(m.id) === String(paymentMethodId));
      const methodId = Number(method?.id ?? paymentMethodId);
      p.transactions = [
        {
          price: totalCents,
          ...(Number.isFinite(methodId) ? { id_transaction_method: methodId } : {}),
          ...(method?.name ? { name: method.name } : {}),
        },
      ];
    }

    if (addCustomer && customerId) {
      p.customer = { id: Number(customerId) };
    }

    if (mode === "delivery") {
      p.address = { ...DUMMY_ADDRESS };
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
    paid,
    paymentMethodId,
    txnMethods,
    optionsList,
  ]);

  async function createOrder() {
    try {
      if (!canCall) throw new Error("Saisis la clé API.");
      if (!cart.length) throw new Error("Panier vide.");
      if (!keyAllowed)
        throw new Error(
          "Restaurant non autorisé (whitelist). Contactez Grégory."
        );
      if (paid) {
        if (!paymentMethodId) throw new Error("Sélectionne une méthode de paiement.");
        if (!payload.transactions?.length || !payload.transactions[0]?.price) {
          throw new Error(
            "Impossible de calculer automatiquement le paiement. Vérifie le panier ou décoche le paiement."
          );
        }
      }

      setLoading(true);
      setStatus("Création de la commande…");

      const created = await zfetch(API_BASE, "/orders", {
        apiKey,
        method: "POST",
        body: payload,
        baseKey: envName,
        params: { rid: restaurantId || undefined },
      });
      const order = created?.order || created;
      if (!order?.id) throw new Error("Réponse inattendue : pas d'ID de commande.");

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
      if (isAggregatorSourceError(err)) {
        openModal(
          "error",
          "Clé API non agrégateur",
          <div>
            La clé API renseignée <b>n’est pas une clé agrégateur</b>. Pour créer des commandes avec une source
            agrégateur, utilisez une clé issue de la fiche Marketplace&nbsp;
            <a
              className="text-accent underline"
              href="https://bo.zelty.fr/marketplace/belorder/status"
              target="_blank"
              rel="noreferrer"
            >
              BelOrder
            </a>.
          </div>
        );
        setStatus("⛔ Clé API non agrégateur.");
      } else {
        setStatus(`❌ ${err.message}`);
        openModal("error", "Erreur", <pre className="whitespace-pre-wrap text-sm">{String(err.message)}</pre>);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
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
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/quick">
              Test (simple)
            </Link>
            <button className="btn-ghost bg-white/10 hover:bg-white/20" onClick={handleLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 -mt-6 pb-16 space-y-6">
        {!keyAllowed && allowMsg && (
          <div className="card px-5 py-3 border-red-200 bg-red-50 text-red-700">
            {allowMsg}
          </div>
        )}

        {status && (
          <div className="card px-5 py-3 border-accent/30">
            <div className="text-sm">{status}</div>
          </div>
        )}

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

        {apiValid && keyAllowed && mode === "delivery" && (
          <section className="card p-6">
            <h2 className="section-title">Adresse de livraison</h2>
            <p className="muted">
              Une adresse fictive est automatiquement utilisée pour ce test :
              <br />10 Rue de la Paix, 75002 Paris (Interphone 42, Bât. A, 2ᵉ étage).
            </p>
          </section>
        )}

        {apiValid && keyAllowed && (
          <>
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

export default OrderPage;
