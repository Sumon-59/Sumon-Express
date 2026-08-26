export type Category = {
  _id: string;
  name: string;
};

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images?: string[];
  isActive?: boolean;
  category?: Category | string | null;
};

export type ProductListResponse = {
  page: number;
  pages: number;
  total: number;
  products: Product[];
};

export const finalPrice = (p: Product) => p.discountPrice ?? p.price;

export const discountPercent = (p: Product) =>
  p.discountPrice && p.discountPrice < p.price
    ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
    : 0;

export const formatTaka = (n: number) => `৳${n.toLocaleString("en-IN")}`;
