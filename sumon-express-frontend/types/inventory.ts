// The low-stock survey endpoint's response (Slice 15) — everything
// CURRENTLY at or below the configured threshold, server-sorted
// ascending by stock (most urgent first).

export type LowStockItem = {
  productId: string;
  name: string;
  variantName?: string;
  stock: number;
};

export type LowStockResponse = {
  threshold: number; // 0 = the feature is disabled
  items: LowStockItem[];
};
