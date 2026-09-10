// Mirror of the backend StoreSettings singleton (Slice 10).
export type StoreSettings = {
  storeName: string;
  logoUrl: string; // empty = text logo
  accentColor: string; // #rrggbb
  heroHeadline: string;
  heroSubtitle: string;
  heroImageUrl: string; // empty = gradient-only hero
  announcement: string; // empty = no announcement bar
  footerText: string;
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
};
