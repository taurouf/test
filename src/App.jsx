import React, { useEffect, useMemo, useState } from "react";

/** =======================
 *  Config Environnements
 *  ======================= */
// const URLS = {
//   production: "https://api.zelty.fr/2.10",
//   staging: "https://api.staging.zelty.co/2.10",
//   // Active ces proxys si tu as configuré vite.config.js (proxy CORS)
//   localProd: "/api",
//   localStaging: "/api-staging",
// };
const API_BASE = "/api/zelty";

const MODE_OPTIONS = [
  { value: "eat_in", label: "Sur place" },
  { value: "takeaway", label: "À emporter" },
  { value: "delivery", label: "Livraison" },
];

const AGG_SOURCES = [
  "pos","remote","web","mobile","kiosk","bo","justeat","foodora","ubereats","glovo","deliveroo","order-it",
];
const LIMITED_SOURCES = ["web", "mobile", "kiosk"]; // hors mode Agrégateur

/** =======================
 *  Util – fetch API
 *  ======================= */
async function zfetch(apiBase, path, { apiKey, method = "GET", body, params, baseKey } = {}) {
  const base = (apiBase || "").replace(/\/$/, "");
  const full = (path.startsWith("/") ? base + path : base + "/" + path);
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
      "Authorization": `Bearer ${apiKey || ""}`,
      "X-Zelty-Base": baseKey || "production",  // 👈 ajoute ce header
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

/** =======================
 *  App
 *  ======================= */
export default function ZeltyOrderApp() {
  // Environnement
  const [envName, setEnvName] = useState("production");
  const API_BASE = URLS[envName];

  // Auth & status
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const canCall = Boolean(apiKey) && apiKey.length > 8 && Boolean(API_BASE);

  // Catalogues
  const [restaurants, setRestaurants] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [optionsList, setOptionsList] = useState([]); // {id, name, values:[{id, name, price}]}
  const [txnMethods, setTxnMethods] = useState([]);

  // Contexte commande
  const [restaurantId, setRestaurantId] = useState("");
  const [mode, setMode] = useState("eat_in");
  const [isAggregator, setIsAggregator] = useState(false);
  const [source, setSource] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Client
  const [addCustomer, setAddCustomer] = useState(false);
  const [customerId, setCustomerId] = useState("");

  // Adresse (livraison)
  const [address, setAddress] = useState({
    name: "", street: "", street_num: "", zip_code: "", city: "",
    address_more: "", floor: "", door: "", building: "", code: ""
  });

  // Panier
  // line dish: { type:"dish", dishId, quantity, optionSelections:{[optionId]: [valueId,...]} }
  // line menu: { type:"menu", menuId, quantity, menuChoices:{[partId]: { dishId, optionSelections:{[optionId]: [valueId,...]} }} }
  const emptyDishLine = () => ({ type: "dish", dishId: "", quantity: 1, optionSelections: {} });
  const emptyMenuLine = () => ({ type: "menu", menuId: "", quantity: 1, menuChoices: {} });
  const [cart, setCart] = useState([emptyDishLine()]);

  // Paiement
  const [paid, setPaid] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(false);

  /** ===== Catalogues ===== */
  useEffect(() => {
    if (!canCall) return;
    (async () => {
      try {
        setStatus("Chargement des catalogues…");
        try {
          const r = await zfetch(API_BASE, "/restaurants", { apiKey,baseKey: envName, });
          const rs = r?.restaurants || [];
          setRestaurants(rs);
          if (rs.length === 1) setRestaurantId(String(rs[0].id));
        } catch (e) {
          console.warn("restaurants", e);
        }

        const d = await zfetch(API_BASE, "/catalog/dishes", { apiKey, params: { lang: "fr", limit: 2000 },baseKey: envName, });
        setDishes(d?.dishes || []);

        const m = await zfetch(API_BASE, "/catalog/menus", { apiKey, params: { lang: "fr", limit: 1000 },baseKey: envName, });
        setMenus(m?.menus || []);

        const o = await zfetch(API_BASE, "/catalog/options", { apiKey, params: { lang: "fr", limit: 2000 },baseKey: envName, });
        setOptionsList(o?.options || []);

        const t = await zfetch(API_BASE, "/transaction-methods", { apiKey,baseKey: envName, });
        setTxnMethods(t?.transaction_methods || []);

        setStatus("Catalogues chargés.");
      } catch (err) {
        setStatus(`Erreur de chargement : ${err.message}`);
      }
    })();
  }, [API_BASE, apiKey, canCall]);

  /** ===== Helpers ===== */
  const findDish = (id) => dishes.find(d => Number(d.id) === Number(id));
  const findMenu = (id) => menus.find(m => Number(m.id) === Number(id));
  const findOption = (id) => optionsList.find(o => Number(o.id) === Number(id));
  const findOptionValue = (opt, valueId) =>
    (opt?.values || []).find(v => Number(v.id) === Number(valueId));

  function updateLine(index, patch) {
    setCart(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addDishLine() { setCart(prev => [...prev, emptyDishLine()]); }
  function addMenuLine() { setCart(prev => [...prev, emptyMenuLine()]); }
  function removeLine(i) { setCart(prev => prev.filter((_, idx) => idx !== i)); }

  // Réinitialiser la source quand on quitte le mode agrégateur et que la valeur n'est pas autorisée
  useEffect(() => {
    if (!isAggregator && source && !LIMITED_SOURCES.includes(source)) {
      setSource("");
    }
  }, [isAggregator, source]);

  /** ===== Payload ===== */
  const payload = useMemo(() => {
    const sourceValue = isAggregator
      ? (source || undefined)
      : (LIMITED_SOURCES.includes(source) ? source : undefined);

    const items = [];

    for (const line of cart) {
      // ---------- PLAT ----------
      if (line.type === "dish" && line.dishId) {
        const entry = {
          type: "dish",
          id: Number(line.dishId),
          quantity: Math.max(1, Number(line.quantity || 1)),
        };

        // MODIFIERS depuis les sélections guidées
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
              price: val?.price ?? 0, // centimes TTC
            });
          });
        }
        if (modifiers.length) entry.modifiers = modifiers;
        items.push(entry);
      }

      // ---------- MENU ----------
      if (line.type === "menu" && line.menuId) {
        const entry = {
          type: "menu",
          id: Number(line.menuId),
          quantity: Math.max(1, Number(line.quantity || 1)),
          dishes: [], // structure attendue par Zelty
        };

        for (const [partId, choice] of Object.entries(line.menuChoices || {})) {
          if (!choice || !choice.dishId) continue;

          // Modifiers par plat de la part
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
    if (addCustomer && customerId) p.customer = { id: Number(customerId) };
    if (mode === "delivery") {
      p.address = { ...address };
      p.fulfillment_type = "deliver_by_restaurant"; // requis en livraison
    }
    return p;
  }, [restaurantId, mode, dueDate, isAggregator, source, cart, addCustomer, customerId, address, optionsList]);

  /** ===== Création ===== */
  async function createOrder() {
    try {
      if (!canCall) throw new Error("Renseigne la clé API.");
      if (!cart.length) throw new Error("Panier vide.");
      setLoading(true);
      setStatus("Création de la commande…");

      const created = await zfetch(API_BASE, "/orders", { apiKey, method: "POST", body: payload, baseKey: envName, });
      const order = created?.order || created;
      if (!order?.id) throw new Error("Réponse inattendue : pas d'ID de commande.");

      if (paid) {
        if (!paymentMethodId) throw new Error("Sélectionne une méthode de paiement.");
        const total = Number(order?.price?.final_amount_inc_tax || 0);
        const method = txnMethods.find((m) => String(m.id) === String(paymentMethodId));
        const methodName = method?.name || "CB";
        await zfetch(API_BASE, `/orders/${order.id}/transactions`, {
          apiKey,
          method: "POST",
          body: { transactions: [{ name: methodName, price: total }], close_if_paid: true },
          baseKey: envName,
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

  /** ====== UI ====== */
  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1>Zelty – Création de commande (React JS)</h1>
      <p style={{ color: "#666", fontSize: 14 }}>{status || "Choisis l’environnement, puis renseigne la clé API pour charger les catalogues."}</p>

      {/* Connexion / Environnement */}
      <fieldset style={fs}>
        <legend>1) Environnement & authentification</legend>
        <div style={row}>
          <div style={col}>
            <label>Environnement</label>
            <select value={envName} onChange={(e) => setEnvName(e.target.value)}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="localProd">Local (proxy) – Prod</option>
              <option value="localStaging">Local (proxy) – Staging</option>
            </select>
            <div style={muted}>URL active : <code>{API_BASE}</code></div>
          </div>

          <div style={col}>
            <label>Clé API (Bearer)</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} placeholder="zk_live_***" />
          </div>

          <div style={col}>
            <label>Restaurant (optionnel)</label>
            <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
              <option value="">—</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{`${r.name} (#${r.id})`}</option>
              ))}
            </select>
            <div style={muted}>Auto-rempli si ta clé est mono-site.</div>
          </div>
        </div>
      </fieldset>

      {/* Infos commande */}
      <fieldset style={fs}>
        <legend>2) Informations de commande</legend>
        <div style={row}>
          <div style={col}>
            <label>Mode de consommation</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div style={col}>
            <label><input type="checkbox" checked={isAggregator} onChange={(e) => setIsAggregator(e.target.checked)} /> Agrégateur ?</label>
          </div>

          {/* Source dynamique selon Agrégateur */}
          <div style={col}>
            <label>Source</label>
            {(() => {
              const sourceOptions = isAggregator ? AGG_SOURCES : LIMITED_SOURCES;
              return (
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">—</option>
                  {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              );
            })()}
            <div style={muted}>
              {isAggregator
                ? "Agrégateur ON : toutes les sources sont disponibles."
                : "Agrégateur OFF : sources limitées à web | mobile | kiosk."}
            </div>
          </div>

          <div style={col}>
            <label>Date/heure (due_date)</label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div style={row}>
          <div style={col}>
            <label><input type="checkbox" checked={addCustomer} onChange={(e) => setAddCustomer(e.target.checked)} /> Ajouter un client ?</label>
          </div>
          {addCustomer && (
            <div style={col}>
              <label>ID client Zelty</label>
              <input type="number" min="0" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="123456" />
            </div>
          )}
        </div>
      </fieldset>

      {/* Adresse livraison */}
      {mode === "delivery" && (
        <fieldset style={fs}>
          <legend>Adresse de livraison</legend>
          <div style={row}>
            <Input label="Nom adresse" value={address.name} onChange={(v) => setAddress(a => ({ ...a, name: v }))} />
            <Input label="N° rue" value={address.street_num} onChange={(v) => setAddress(a => ({ ...a, street_num: v }))} />
            <Input label="Rue" value={address.street} onChange={(v) => setAddress(a => ({ ...a, street: v }))} />
            <Input label="Complément" value={address.address_more} onChange={(v) => setAddress(a => ({ ...a, address_more: v }))} />
            <Input label="Code postal" value={address.zip_code} onChange={(v) => setAddress(a => ({ ...a, zip_code: v }))} />
            <Input label="Ville" value={address.city} onChange={(v) => setAddress(a => ({ ...a, city: v }))} />
            <Input label="Étage" value={address.floor} onChange={(v) => setAddress(a => ({ ...a, floor: v }))} />
            <Input label="Porte" value={address.door} onChange={(v) => setAddress(a => ({ ...a, door: v }))} />
            <Input label="Bâtiment" value={address.building} onChange={(v) => setAddress(a => ({ ...a, building: v }))} />
            <Input label="Code immeuble" value={address.code} onChange={(v) => setAddress(a => ({ ...a, code: v }))} />
          </div>
        </fieldset>
      )}

      {/* Panier */}
      <fieldset style={fs}>
        <legend>3) Panier – Produits, options guidées & menus</legend>

        <div style={{ display: "grid", gap: 12 }}>
          {cart.map((line, idx) => {
            const isDish = line.type === "dish";
            const isMenu = line.type === "menu";
            const dish = isDish && line.dishId ? findDish(line.dishId) : null;
            const menu = isMenu && line.menuId ? findMenu(line.menuId) : null;

            // Résumé lisible des options d'un plat
            let optionsText = "";
            if (isDish && dish) {
              const parts = [];
              for (const [optId, valueIds] of Object.entries(line.optionSelections || {})) {
                const opt = findOption(optId);
                const names = (Array.isArray(valueIds) ? valueIds : [valueIds])
                  .map(vId => findOptionValue(opt, vId)?.name)
                  .filter(Boolean);
                if (opt && names.length) parts.push(`${opt.name}: ${names.join(" + ")}`);
              }
              optionsText = parts.join(", ");
            }

            // Résumé lisible des choix de menu (+ options par part)
            let menuChoicesText = "";
            if (isMenu && menu) {
              const parts = [];
              for (const [partId, choice] of Object.entries(line.menuChoices || {})) {
                const part = (menu.parts || []).find(p => Number(p.id) === Number(partId));
                const chosenDish = choice?.dishId ? findDish(choice.dishId) : null;

                const optBits = [];
                for (const [optId, valIds] of Object.entries(choice?.optionSelections || {})) {
                  const opt = findOption(optId);
                  const names = (Array.isArray(valIds) ? valIds : [valIds])
                    .map(vId => findOptionValue(opt, vId)?.name)
                    .filter(Boolean);
                  if (opt && names.length) optBits.push(`${opt.name}: ${names.join(" + ")}`);
                }

                if (part && chosenDish) {
                  parts.push(`${part.name || `Part ${partId}`}→${chosenDish.name}${optBits.length ? ` [${optBits.join(", ")}]` : ""}`);
                }
              }
              menuChoicesText = parts.join(", ");
            }

            return (
              <div key={idx} className="cart-line" style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={row}>
                  <div style={col}>
                    <label>Type</label>
                    <select
                      value={line.type}
                      onChange={(e) =>
                        updateLine(idx, e.target.value === "menu"
                          ? { type: "menu", menuId: "", menuChoices: {}, quantity: line.quantity }
                          : { type: "dish", dishId: "", optionSelections: {}, quantity: line.quantity })
                      }
                    >
                      <option value="dish">Plat</option>
                      <option value="menu">Menu</option>
                    </select>
                  </div>

                  <div style={col}>
                    <label>Quantité</label>
                    <input
                      type="number" min="1" value={line.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>

                  <div style={col}>
                    <button onClick={() => removeLine(idx)}>Supprimer</button>
                  </div>
                </div>

                {isDish && (
                  <>
                    <div style={row}>
                      <div style={col}>
                        <label>Plat</label>
                        <select
                          value={line.dishId}
                          onChange={(e) => updateLine(idx, { dishId: e.target.value, optionSelections: {} })}
                        >
                          <option value="">—</option>
                          {dishes.map((d) => (
                            <option key={d.id} value={d.id}>{`${d.name} (#${d.id})`}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Options guidées — repliable */}
                    <details style={{ marginTop: 8 }}>
                      <summary style={summaryStyle}>
                        Options {optionsText ? `(${optionsText.split(/[,+]/).filter(Boolean).length} sélectionnées)` : ""}
                      </summary>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        {optionsList.map((opt) => {
                          const current = Array.isArray(line.optionSelections?.[opt.id]) ? line.optionSelections[opt.id] : [];
                          const count = current.length || 0;
                          return (
                            <details key={opt.id}>
                              <summary style={groupSummaryStyle}>{`${opt.name} (#${opt.id})${count ? ` — ${count}` : ""}`}</summary>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                {(opt.values || []).map((v) => {
                                  const checked = current.includes(String(v.id));
                                  return (
                                    <label key={v.id} style={chip}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const now = Array.isArray(line.optionSelections?.[opt.id]) ? line.optionSelections[opt.id] : [];
                                          const next = e.target.checked ? [...now, String(v.id)] : now.filter((x) => x !== String(v.id));
                                          updateLine(idx, { optionSelections: { ...(line.optionSelections || {}), [opt.id]: next } });
                                        }}
                                      />
                                      {v.name} {v.price ? `(+${(v.price / 100).toFixed(2)}€)` : ""}
                                    </label>
                                  );
                                })}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </details>

                    {/* Résumé lisible */}
                    {dish && (
                      <div style={{ marginTop: 8, color: "#333" }}>
                        <b>{`${dish.name} × ${line.quantity}`}</b>
                        {optionsText ? <span>{` — ${optionsText}`}</span> : null}
                      </div>
                    )}
                  </>
                )}

                {isMenu && (
                  <>
                    <div style={row}>
                      <div style={col}>
                        <label>Menu</label>
                        <select
                          value={line.menuId}
                          onChange={(e) => updateLine(idx, { menuId: e.target.value, menuChoices: {} })}
                        >
                          <option value="">—</option>
                          {menus.map((m) => (
                            <option key={m.id} value={m.id}>{`${m.name} (#${m.id})`}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Parties + options par partie (repliables) */}
                    {menu && Array.isArray(menu.parts) && (
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        {menu.parts.map((part) => {
                          const choice = line.menuChoices?.[part.id] || { dishId: "", optionSelections: {} };
                          const setChoice = (patch) =>
                            updateLine(idx, {
                              menuChoices: { ...(line.menuChoices || {}), [part.id]: { ...choice, ...patch } },
                            });

                          const chosenDish = choice.dishId ? findDish(choice.dishId) : null;

                          // Compter sélection d'options pour la part
                          const totalSelectedForPart = Object.values(choice.optionSelections || {})
                            .reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0);

                          return (
                            <div key={part.id} style={{ border: "1px dashed #ddd", borderRadius: 8, padding: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {part.name || `Partie #${part.id}`} {part.max ? `(max ${part.max})` : ""}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <select
                                  value={choice.dishId || ""}
                                  onChange={(e) => setChoice({ dishId: e.target.value, optionSelections: {} })}
                                >
                                  <option value="">—</option>
                                  {(part.dishes || []).map((did) => {
                                    const d = findDish(did);
                                    return d ? <option key={did} value={did}>{d.name}</option> : null;
                                  })}
                                </select>
                              </div>

                              {/* Options pour le plat de cette partie — repliables */}
                              {chosenDish && (
                                <details style={{ marginTop: 10 }}>
                                  <summary style={summaryStyle}>
                                    {`Options pour ${chosenDish.name}`} {totalSelectedForPart ? `(${totalSelectedForPart} sélectionnées)` : ""}
                                  </summary>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                                    {optionsList.map((opt) => {
                                      const current = Array.isArray(choice.optionSelections?.[opt.id]) ? choice.optionSelections[opt.id] : [];
                                      const count = current.length || 0;
                                      return (
                                        <details key={opt.id}>
                                          <summary style={groupSummaryStyle}>{`${opt.name} (#${opt.id})${count ? ` — ${count}` : ""}`}</summary>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                            {(opt.values || []).map((v) => {
                                              const checked = current.includes(String(v.id));
                                              return (
                                                <label key={v.id} style={chip}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                      const now = Array.isArray(choice.optionSelections?.[opt.id]) ? choice.optionSelections[opt.id] : [];
                                                      const next = e.target.checked ? [...now, String(v.id)] : now.filter((x) => x !== String(v.id));
                                                      setChoice({ optionSelections: { ...(choice.optionSelections || {}), [opt.id]: next } });
                                                    }}
                                                  />
                                                  {v.name} {v.price ? `(+${(v.price / 100).toFixed(2)}€)` : ""}
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

                    {/* Résumé lisible des choix */}
                    {menu && (
                      <div style={{ marginTop: 8, color: "#333" }}>
                        <b>{`${menu.name} × ${line.quantity}`}</b>
                        {menuChoicesText ? <span>{` — (${menuChoicesText})`}</span> : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addDishLine}>+ Ajouter un plat</button>
            <button onClick={addMenuLine}>+ Ajouter un menu</button>
          </div>
        </div>
      </fieldset>

      {/* Paiement */}
      <fieldset style={fs}>
        <legend>4) Paiement</legend>
        <div style={row}>
          <div style={col}>
            <label><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Commande payée ?</label>
          </div>
          {paid && (
            <div style={col}>
              <label>Méthode de paiement</label>
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                <option value="">—</option>
                {txnMethods.map((m) => (
                  <option key={m.id} value={m.id}>{`${m.name} (#${m.id})`}</option>
                ))}
              </select>
            </div>
          )}
          <div style={col}>
            <button onClick={() => console.log("DEBUG payload:", payload)} type="button">🧪 Debug console</button>
            <button onClick={createOrder} disabled={loading || !canCall} type="button">🧾 Créer la commande</button>
          </div>
        </div>

        <details style={{ marginTop: 8 }}>
          <summary>Payload (temps réel)</summary>
          <pre style={{ background: "#0b1021", color: "#e6e6e6", padding: 12, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      </fieldset>

      {/* Catalogues consultatifs */}
      <fieldset style={fs}>
        <legend>Catalogues chargés</legend>
        <details>
          <summary>Produits</summary>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {dishes.slice(0, 80).map((x) => (
              <span key={x.id} style={pill}>{`${x.name} (#${x.id})`}</span>
            ))}
            {dishes.length > 80 && <div style={muted}>+{dishes.length - 80} autres…</div>}
          </div>
        </details>
        <details>
          <summary>Menus</summary>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {menus.slice(0, 60).map((x) => (
              <span key={x.id} style={pill}>{`${x.name} (#${x.id})`}</span>
            ))}
            {menus.length > 60 && <div style={muted}>+{menus.length - 60} autres…</div>}
          </div>
        </details>
        <details>
          <summary>Options</summary>
          <div style={{ marginTop: 8 }}>
            {optionsList.slice(0, 30).map((opt) => (
              <div key={opt.id}>
                <b>{opt.name}</b> (#{opt.id}) — {(opt.values || []).slice(0, 10).map((v) => `${v.name} (#${v.id})`).join(", ")}{(opt.values || []).length > 10 ? "…" : ""}
              </div>
            ))}
            {optionsList.length > 30 && <div style={muted}>+{optionsList.length - 30} autres…</div>}
          </div>
        </details>
      </fieldset>
    </div>
  );
}

/** ===== Helpers UI ===== */
function Input({ label, value, onChange, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <span style={{ color: "#444", fontSize: 13 }}>{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: "8px 10px" }}
      />
    </label>
  );
}

/** ===== Styles ===== */
const fs = { border: "1px solid #ddd", borderRadius: 10, padding: "12px 16px", margin: "12px 0" };
const row = { display: "flex", gap: 12, flexWrap: "wrap" };
const col = { flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 6 };
const muted = { color: "#666", fontSize: 12 };
const pill = { display: "inline-block", padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999, background: "#fafafa" };
const summaryStyle = { cursor: "pointer", userSelect: "none", fontWeight: 600 };
const groupSummaryStyle = { cursor: "pointer", userSelect: "none" };
const chip = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #ddd", borderRadius: 999, padding: "4px 8px" };
