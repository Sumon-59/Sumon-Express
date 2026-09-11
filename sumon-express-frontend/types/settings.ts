// Mirror of the backend StoreSettings singleton (Slice 10).

// Mirror of the backend HEX_COLOR rule — the server gates writes; this
// guards what actually reaches the DOM (defense in depth for legacy or
// hand-edited documents).
export const isHexColor = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
// One shipping option (Slice 12) — fee in whole taka, ETA free text.
export type ShippingMethod = {
  key: string;
  label: string;
  fee: number;
  eta: string;
};

export type StoreSettings = {
  storeName: string;
  logoUrl: string; // empty = text logo
  accentColor: string; // #rrggbb
  heroHeadline: string;
  heroSubtitle: string;
  heroImageUrl: string; // empty = gradient-only hero
  announcement: string; // empty = no announcement bar
  footerText: string;
  shippingMethods: ShippingMethod[];
  lowStockThreshold: number; // 0 = alerts disabled
};

// Same defaults as the backend schema: the storefront renders the
// stock brand while settings load (or if the fetch fails) — no flash
// of blank branding, no layout shift.
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Sumon Express",
  logoUrl: "",
  accentColor: "#ea580c",
  heroHeadline: "Everything you need, delivered express.",
  heroSubtitle:
    "Shop electronics, accessories and more — with cash on delivery across Bangladesh.",
  heroImageUrl: "",
  announcement: "",
  footerText: "Sumon Express",
  shippingMethods: [
    { key: "inside-dhaka", label: "Inside Dhaka", fee: 60, eta: "1-2 days" },
    { key: "outside-dhaka", label: "Outside Dhaka", fee: 120, eta: "3-5 days" },
  ],
  lowStockThreshold: 5,
};
