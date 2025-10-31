export function extractPriceCents(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object") {
    const keys = [
      "price_inc_tax",
      "price_inc",
      "price",
      "amount_inc_tax",
      "amount",
      "value",
      "default_price_inc_tax",
      "default_price",
    ];
    for (const key of keys) {
      if (key in value) {
        const extracted = extractPriceCents(value[key]);
        if (extracted) return extracted;
      }
    }
  }
  return 0;
}

// --- Prix & totaux (en centimes) ---
export function toCents(n) {
  const x = Math.round(Number(n || 0));
  return Number.isFinite(x) && x > 0 ? x : 0;
}

export function pickPriceByMode(entity, mode) {
  if (!entity) return 0;
  if (entity.prices && entity.prices[mode] != null) {
    return toCents(entity.prices[mode]);
  }
  const key = `price_${mode}`;
  if (entity[key] != null) return toCents(entity[key]);
  if (entity.price_inc_tax != null) return toCents(entity.price_inc_tax);
  if (entity.price != null) return toCents(entity.price);
  return 0;
}

export function getDishUnitPrice(dish, mode) {
  return pickPriceByMode(dish, mode);
}

export function getMenuUnitPrice(menu, mode) {
  return pickPriceByMode(menu, mode);
}

export function sumModifiersPrice(optionSelections, optionsList) {
  let sum = 0;
  if (!optionSelections) return 0;
  for (const [optId, valIdsRaw] of Object.entries(optionSelections)) {
    const opt = optionsList.find((o) => Number(o.id) === Number(optId));
    if (!opt) continue;
    const valIds = Array.isArray(valIdsRaw) ? valIdsRaw : [valIdsRaw];
    for (const vId of valIds) {
      const val = (opt.values || []).find((v) => Number(v.id) === Number(vId));
      if (val && val.price != null) sum += toCents(val.price);
    }
  }
  return sum;
}

export function computeLineTotal(line, mode, dishes, menus, optionsList) {
  if (!line || !line.quantity) return 0;
  const qty = Math.max(1, Number(line.quantity || 1));

  if (line.type === "dish" && line.dishId) {
    const dish = dishes.find((d) => Number(d.id) === Number(line.dishId));
    const base = dish ? getDishUnitPrice(dish, mode) : 0;
    const mods = sumModifiersPrice(line.optionSelections, optionsList);
    return qty * (base + mods);
  }

  if (line.type === "menu" && line.menuId) {
    const menu = menus.find((m) => Number(m.id) === Number(line.menuId));
    let base = menu ? getMenuUnitPrice(menu, mode) : 0;
    let partsDishSum = 0;
    let modifiersTotal = 0;

    for (const [, choice] of Object.entries(line.menuChoices || {})) {
      if (!choice?.dishId) continue;
      const dish = dishes.find((d) => Number(d.id) === Number(choice.dishId));
      partsDishSum += dish ? getDishUnitPrice(dish, mode) : 0;
      modifiersTotal += sumModifiersPrice(choice.optionSelections, optionsList);
    }

    if (base === 0) {
      base = partsDishSum;
    }

    return qty * (base + modifiersTotal);
  }

  return 0;
}

export function computeCartTotal(cart, mode, dishes, menus, optionsList) {
  return (cart || []).reduce(
    (acc, line) => acc + computeLineTotal(line, mode, dishes, menus, optionsList),
    0
  );
}
