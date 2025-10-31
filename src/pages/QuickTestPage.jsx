import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import BlockingLoader from "../components/BlockingLoader.jsx";
import {
  API_BASE,
  DISPLAY_BASES,
  MODE_OPTIONS,
  DUMMY_ADDRESS,
} from "../utils/constants.js";
import { zfetch } from "../utils/api.js";
import { isAggregatorSourceError } from "../utils/errors.js";
import { extractPriceCents } from "../utils/pricing.js";

function QuickTestPage() {
  const [envName, setEnvName] = useState("production");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(
    "Choisis l’environnement, puis renseigne la clé API."
  );

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [apiValid, setApiValid] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [wlLoading, setWlLoading] = useState(false);
  const [validatingRid, setValidatingRid] = useState(false);

  const [whitelist, setWhitelist] = useState([]);
  const [keyAllowed, setKeyAllowed] = useState(true);
  const [allowMsg, setAllowMsg] = useState("");

  const [dishes, setDishes] = useState([]);
  const [txnMethods, setTxnMethods] = useState([]);

  const [mode, setMode] = useState("eat_in");

  const [paid, setPaid] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState("");

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

  const canCall = Boolean(apiKey) && apiKey.length > 8;
  const navigate = useNavigate();
  const getDishPrice = (dish) =>
    extractPriceCents(
      dish?.price ?? dish?.price_inc_tax ?? dish?.default_price ?? dish
    );

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let alive = true;
    setWlLoading(true);
    setWhitelist([]);

    (async () => {
      try {
        const wlRes = await fetch(`/api/admin/whitelist?env=${envName}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!alive) return;
        if (wlRes.ok) {
          const j = await wlRes.json();
          const ids = Array.isArray(j.ids) ? j.ids.map(Number) : [];
          setWhitelist(ids);
        } else {
          setWhitelist([]);
        }
      } catch {
        if (alive) setWhitelist([]);
      } finally {
        if (alive) setWlLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [envName]);

  useEffect(() => {
    let alive = true;
    setValidatingKey(false);

    if (!canCall) {
      setApiValid(false);
      setKeyAllowed(true);
      setRestaurants([]);
      setRestaurantId("");
      setAllowMsg("");
      setStatus("Choisis l’environnement, puis renseigne la clé API.");
      return;
    }

    if (wlLoading) {
      setStatus("Chargement des autorisations (whitelist)…");
      return;
    }

    (async () => {
      try {
        setValidatingKey(true);
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
          const inWl = whitelist.includes(rid);
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
            setAllowMsg(
              "⚠️ La clé est valide mais le restaurant lié n’est pas autorisé à créer des commandes de test. Contactez Grégory."
            );
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
  }, [apiKey, envName, canCall, wlLoading, whitelist]);

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
      .catch(() => {})
      .finally(() => setValidatingRid(false));
  }, [restaurantId, wlLoading, apiKey, envName, whitelist]);

  useEffect(() => {
    if (!apiValid || !keyAllowed) return;
    (async () => {
      try {
        setStatus("Chargement du catalogue minimal…");
        const d = await zfetch(API_BASE, "/catalog/dishes", {
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
        setTxnMethods(t?.transaction_methods || []);
        setStatus("✅ Prêt à créer une commande test.");
      } catch (e) {
        setStatus(`❌ ${e.message}`);
      }
    })();
  }, [apiValid, keyAllowed, apiKey, envName, restaurantId]);

  const CARDS = [
    {
      key: "ubereats",
      label: "Uber Eats",
      emoji: "🚗",
      image: "/logos/uber-eats.svg",
      desc: "Commande via agrégateur Uber Eats",
    },
    {
      key: "deliveroo",
      label: "Deliveroo",
      emoji: "🦘",
      image: "/logos/deliveroo.svg",
      desc: "Commande via agrégateur Deliveroo",
    },
    {
      key: "justeat",
      label: "Just Eat",
      emoji: "🍽️",
      image: "/logos/just-eat.svg",
      desc: "Commande via agrégateur Just Eat",
    },
    {
      key: "glovo",
      label: "Glovo",
      emoji: "📦",
      image: "/logos/glovo.svg",
      desc: "Commande via agrégateur Glovo",
    },
    { key: "web", label: "Commande Web", emoji: "🌐", desc: "Commande placée sur le site web" },
    { key: "mobile", label: "Mobile", emoji: "📱", desc: "Commande mobile" },
    { key: "kiosk", label: "Kiosk", emoji: "🖥️", desc: "Commande borne" },
  ];

  async function createQuickOrder(sourceKey) {
    try {
      if (!canCall) throw new Error("Saisis la clé API.");
      if (!restaurantId) throw new Error("Choisis un restaurant.");
      if (!keyAllowed) throw new Error("Restaurant non autorisé (whitelist).");

      if (!dishes.length) throw new Error("Aucun produit dans le catalogue.");

      let dish = dishes[0];
      let baseDishPrice = getDishPrice(dish);

      if (paid && baseDishPrice <= 0) {
        const fallback = dishes.find((d) => getDishPrice(d) > 0);
        if (fallback) {
          dish = fallback;
          baseDishPrice = getDishPrice(fallback);
        }
      }

      const payload = {
        id_restaurant: Number(restaurantId),
        mode,
        source: sourceKey,
        items: [{ type: "dish", id: Number(dish.id), quantity: 1 }],
      };

      if (mode === "delivery") {
        payload.address = { ...DUMMY_ADDRESS };
        payload.fulfillment_type = "deliver_by_partner";
      }

      const modifiersTotal = (payload.items[0].modifiers || []).reduce(
        (sum, mod) => sum + Number(mod.price ?? 0),
        0
      );
      const totalCents = baseDishPrice + modifiersTotal;

      if (paid) {
        if (!paymentMethodId) throw new Error("Sélectionne une méthode de paiement.");
        if (totalCents <= 0)
          throw new Error("Impossible de calculer le montant à payer. Vérifie le produit sélectionné.");
        payload.total = totalCents;
      }

      const includePayment = paid && paymentMethodId;
      if (includePayment) {
        payload.transactions = [
          {
            id_transaction_method: Number(paymentMethodId),
          },
        ];
        payload.close_if_paid = true;
      }

      setStatus(`Création d'une commande test (${sourceKey})…`);
      const bodyForCreate = { ...payload };
      let created;
      let order;
      try {
        created = await zfetch(API_BASE, "/orders", {
          apiKey,
          method: "POST",
          body: bodyForCreate,
          baseKey: envName,
          params: { rid: restaurantId || undefined },
        });
        order = created?.order || created;
      } catch (err) {
        const message = String(err?.message || "");
        const shouldFallback =
          includePayment && /transactions?/i.test(message) && /price/i.test(message);
        if (!shouldFallback) throw err;

        const fallbackBody = { ...payload };
        delete fallbackBody.transactions;
        delete fallbackBody.close_if_paid;

        created = await zfetch(API_BASE, "/orders", {
          apiKey,
          method: "POST",
          body: fallbackBody,
          baseKey: envName,
          params: { rid: restaurantId || undefined },
        });
        order = created?.order || created;
        if (!order?.id) throw new Error("Réponse inattendue : pas d'ID de commande.");

        await zfetch(API_BASE, `/orders/${order.id}/transactions`, {
          apiKey,
          method: "POST",
          baseKey: envName,
          params: { rid: restaurantId || undefined },
          body: {
            transactions: [
              {
                id_transaction_method: Number(paymentMethodId),
                price: Number(order?.price?.final_amount_inc_tax ?? totalCents),
              },
            ],
            close_if_paid: true,
          },
        });
      }

      if (!order?.id) throw new Error("Réponse inattendue : pas d'ID de commande.");

      openModal(
        "success",
        "Commande test créée 🎉",
        <div>
          Source : <b>{sourceKey}</b>
          <div className="mt-1 text-sm">Commande #{order.id}</div>
        </div>
      );
      setStatus(`✅ Commande #${order.id} créée${paid ? " et payée" : ""}.`);
    } catch (e) {
      if (isAggregatorSourceError(e)) {
        openModal(
          "error",
          "Clé API non agrégateur",
          <div>
            La clé API renseignée <b>n’est pas une clé agrégateur</b>. Pour utiliser les sources agrégateurs
            (Uber Eats, Deliveroo, Just Eat, …), créez une clé API dédiée depuis la fiche Marketplace&nbsp;
            <a
              className="text-accent underline"
              href="https://bo.zelty.fr/marketplace/belorder/status"
              target="_blank"
              rel="noreferrer"
            >
              BelOrder
            </a>
            , puis réessayez.
          </div>
        );
        setStatus("⛔ Clé API non agrégateur.");
      } else {
        openModal("error", "Erreur", <pre className="whitespace-pre-wrap text-sm">{String(e.message)}</pre>);
        setStatus(`❌ ${e.message}`);
      }
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-hero-grad text-white">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Zelty – Création de commande (Test)
            </h1>
            <p className="mt-2 text-white/80">
              Saisis la clé API, choisis le restaurant puis crée une commande test en un clic.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="btn-ghost bg-white/10 hover:bg-white/20" to="/advanced">
              Mode avancé
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
              <select className="select" value={envName} onChange={(e) => setEnvName(e.target.value)}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Dev</option>
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
                <label className="label">Restaurant</label>
                <select
                  className="select"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                >
                  <option value="">—</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {(r.public_name || r.name || `Restaurant #${r.id}`) + ` (#${r.id})`}
                    </option>
                  ))}
                </select>
                <p className="muted mt-1">Auto-rempli si la clé est mono-site.</p>
              </div>
            )}
          </div>
        </section>

        {apiValid && keyAllowed && (
          <section className="card p-6">
            <h2 className="section-title">2) Paramètres</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="label">Mode de consommation</label>
                <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-3">
                <input
                  id="paid-quick"
                  type="checkbox"
                  className="h-5 w-5 accent-success"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                <label htmlFor="paid-quick" className="label !mb-0">Commande payée ?</label>
              </div>

              {paid && (
                <div>
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
            </div>

            {mode === "delivery" && (
              <p className="muted mt-6">
                Adresse de test utilisée automatiquement : 10 Rue de la Paix, 75002 Paris.
              </p>
            )}
          </section>
        )}

        {apiValid && keyAllowed && (
          <section className="card p-6">
            <h2 className="section-title">3) Choisis une source</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CARDS.map((c) => (
                <button
                  key={c.key}
                  className="group text-left rounded-2xl border border-primary/10 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition ring-1 ring-transparent hover:ring-accent/30"
                  onClick={() => createQuickOrder(c.key)}
                  title={`Créer une commande test — ${c.label}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 grid place-items-center rounded-xl bg-accent/10 text-2xl">
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.label}
                          className="h-8 w-8 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span>{c.emoji}</span>
                      )}
                    </div>
                    <div className="grow">
                      <div className="font-semibold text-primary">{c.label}</div>
                      <div className="text-sm text-slate-600 mt-1">{c.desc}</div>
                    </div>
                    <svg className="h-5 w-5 text-accent opacity-0 group-hover:opacity-100 transition" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={modalTitle} kind={modalKind}>
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

export default QuickTestPage;
