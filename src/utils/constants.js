export const DISPLAY_BASES = {
  production: "https://api.zelty.fr/2.10",
  staging: "https://api.staging.zelty.co/2.10",
};

export const API_BASE = "/api/zelty";

export const MODE_OPTIONS = [
  { value: "eat_in", label: "Sur place" },
  { value: "takeaway", label: "À emporter" },
  { value: "delivery", label: "Livraison" },
];

export const AGG_SOURCES = [
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

export const LIMITED_SOURCES = ["web", "mobile", "kiosk"];

export const DUMMY_ADDRESS = {
  name: "Client Test",
  street: "Rue de la Paix",
  street_num: "10",
  zip_code: "75002",
  city: "Paris",
  address_more: "Interphone 42",
  floor: "2",
  door: "B",
  building: "A",
  code: "4242",
};
