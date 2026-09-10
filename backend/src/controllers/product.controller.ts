import { Request, Response } from "express";
import { Types } from "mongoose";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { sessionUser } from "../middleware/requireAuth";
import { httpError } from "../types/http.types";
import { parsePagination, pageMeta } from "../utils/pagination";
import { escapeRegex } from "../utils/regex";

interface VariantInput {
  name?: unknown;
  stock?: unknown;
  price?: unknown;
}

interface ProductBody {
  name?: string;
  description?: string;
  price?: number;
  discountPrice?: number | null; // null = remove the discount
  stock?: number;
  category?: string;
  images?: string[];
  isActive?: boolean;
  optionName?: string | null; // null = remove the axis
  variants?: VariantInput[] | null;
}

/**
 * THE product data rules (Slice 2), applied to create and update.
 * `current` supplies existing values so partial updates validate the
 * EFFECTIVE result (e.g. a new discount against the unchanged price).
 * Violations answer 400 naming the offending field.
 */
const validateProductData = (
  data: ProductBody,
  current?: { price: number; discountPrice?: number }
) => {
  if (data.name !== undefined && (typeof data.name !== "string" || !data.name.trim())) {
    throw httpError("name must be a non-empty string", 400);
  }
  if (
    data.description !== undefined &&
    (typeof data.description !== "string" || !data.description.trim())
  ) {
    throw httpError("description must be a non-empty string", 400);
  }
  if (data.category !== undefined && data.category !== null && data.category !== "") {
    if (!Types.ObjectId.isValid(data.category)) {
      throw httpError("category must be a valid category id", 400);
    }
  }
  if (data.price !== undefined && (typeof data.price !== "number" || Number.isNaN(data.price) || data.price < 0)) {
    throw httpError("price must be a non-negative number", 400);
  }
  if (data.stock !== undefined && (typeof data.stock !== "number" || !Number.isInteger(data.stock) || data.stock < 0)) {
    throw httpError("stock must be a non-negative whole number", 400);
  }

  const effectivePrice = data.price ?? current?.price;
  const effectiveDiscount = data.discountPrice === undefined ? current?.discountPrice : data.discountPrice;

  if (effectiveDiscount !== undefined && effectiveDiscount !== null) {
    if (typeof effectiveDiscount !== "number" || Number.isNaN(effectiveDiscount) || effectiveDiscount < 0) {
      throw httpError("discountPrice must be a non-negative number", 400);
    }
    if (effectivePrice !== undefined && effectiveDiscount >= effectivePrice) {
      throw httpError("discountPrice must be less than price", 400);
    }
  }

  // The option axis (Slice 7) is part of THE choke point — its rules
  // live here, nowhere else (review restored the documented rule).
  return validateVariantAxis(data);
};

export const sumVariantStock = (variants: { stock: number }[]): number =>
  variants.reduce((sum, v) => sum + v.stock, 0);

/**
 * The option-axis rules (called ONLY from validateProductData). The
 * axis is all-or-nothing: an optionName with at least one value, or
 * neither field. Editing is full-axis replace. Returns the fields to
 * persist — for a variant product, top-level stock is the
 * SERVER-computed sum (client stock ignored); null optionName+variants
 * removes the axis.
 */
const validateVariantAxis = (
  data: ProductBody
): { optionName?: string | null; variants?: { name: string; stock: number; price?: number | null }[] | null; stock?: number } => {
  // An explicit empty array is an attempted axis with no values — a
  // client bug, not a silent no-op (review catch).
  if (Array.isArray(data.variants) && data.variants.length === 0 && data.variants !== null) {
    throw httpError("variants must include at least one value", 400);
  }
  const wantsAxis = data.optionName != null || (data.variants != null && data.variants.length > 0);
  if (!wantsAxis) {
    // Explicit removal: both null.
    if (data.optionName === null || data.variants === null) {
      return { optionName: null, variants: null };
    }
    return {};
  }

  if (typeof data.optionName !== "string" || !data.optionName.trim()) {
    throw httpError("optionName is required when variants are set", 400);
  }
  if (!Array.isArray(data.variants) || data.variants.length === 0) {
    throw httpError("variants must include at least one value", 400);
  }

  const seen = new Set<string>();
  const variants = data.variants.map((v) => {
    if (typeof v.name !== "string" || !v.name.trim()) {
      throw httpError("every variant needs a non-empty name", 400);
    }
    const name = v.name.trim();
    if (seen.has(name)) {
      throw httpError(`variant names must be unique (duplicate: ${name})`, 400);
    }
    seen.add(name);

    const stock = Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw httpError(`variant "${name}": stock must be a non-negative whole number`, 400);
    }

    let price: number | null = null;
    if (v.price !== undefined && v.price !== null) {
      price = Number(v.price);
      if (Number.isNaN(price) || price < 0) {
        throw httpError(`variant "${name}": price must be a non-negative number`, 400);
      }
    }
    return { name, stock, price };
  });

  return {
    optionName: data.optionName.trim(),
    variants,
    stock: sumVariantStock(variants),
  };
};

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, price, discountPrice, stock, category, images } =
    req.body as ProductBody;

  if (!name) throw httpError("name is required", 400);
  if (!description) throw httpError("description is required", 400);
  if (price === undefined) throw httpError("price is required", 400);

  const axis = validateProductData(req.body as ProductBody);
  // Plain products need a stock; variant products get the computed sum.
  if (stock === undefined && axis.stock === undefined) {
    throw httpError("stock is required", 400);
  }

  const product = await Product.create({
    name,
    description,
    price,
    discountPrice: discountPrice ?? undefined,
    // Variant products: stock is the server-computed sum of values.
    stock: axis.stock ?? stock,
    optionName: axis.optionName ?? undefined,
    variants: axis.variants ?? undefined,
    category,
    images,
    createdBy: sessionUser(req)._id,
  });
  res.status(201).json(product);
});

// A price bound from the query string: absent is fine, non-numeric is
// a named 400 (a UI bug, not a shopper choice).
const parsePriceBound = (raw: unknown, name: string): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (String(raw).trim() === "" || !Number.isFinite(n)) {
    throw httpError(`${name} must be a number`, 400);
  }
  return n;
};

// One aggregation runs every public listing variant: search, filters,
// and sorts all share the SAME effective-price definition (review
// catch: filters compared the sale price while sorts used the sticker
// price — "cheapest first" could disagree with "under ৳500").
const runPublicListing = async (
  match: Record<string, unknown>,
  sort: Record<string, 1 | -1 | { $meta: "textScore" }>,
  paging: { skip: number; limit: number }
) => {
  const products = await Product.aggregate([
    { $match: match },
    { $addFields: { effectivePrice: { $ifNull: ["$discountPrice", "$price"] } } },
    { $sort: sort },
    { $skip: paging.skip },
    { $limit: paging.limit },
    // populate("category", "name"), aggregation-style:
    { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "_cat" } },
    {
      $addFields: {
        category: { $arrayElemAt: [{ $map: { input: "$_cat", as: "c", in: { _id: "$$c._id", name: "$$c.name" } } }, 0] },
      },
    },
    { $project: { _cat: 0, effectivePrice: 0, _score: 0 } },
  ]);
  return products;
};

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const paging = parsePagination(req);

  // Price sorts use the EFFECTIVE price, same as the price filters —
  // one definition of "price" across the whole listing.
  const explicitSort: Record<string, 1 | -1> | null =
    req.query.sort === "price_asc"
      ? { effectivePrice: 1, _id: 1 }
      : req.query.sort === "price_desc"
        ? { effectivePrice: -1, _id: 1 }
        : null;

  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.category) {
    // aggregate() does NOT auto-cast strings to ObjectId the way
    // find() does — the aggregation gotcha. Cast here or match nothing.
    const cat = String(req.query.category);
    filter.category = Types.ObjectId.isValid(cat) ? new Types.ObjectId(cat) : cat;
  }
  if (req.query.inStock === "true") {
    // Correct for variant products for free: their stock is the sum.
    filter.stock = { $gt: 0 };
  }

  // Price bounds mean the EFFECTIVE price — what the shopper pays.
  // Filtering the sticker price silently lies the moment anything goes
  // on sale (the slice's trap; see the boundary tests).
  const minPrice = parsePriceBound(req.query.minPrice, "minPrice");
  const maxPrice = parsePriceBound(req.query.maxPrice, "maxPrice");
  const effective = { $ifNull: ["$discountPrice", "$price"] };
  const priceExprs: unknown[] = [];
  if (minPrice !== undefined) priceExprs.push({ $gte: [effective, minPrice] });
  if (maxPrice !== undefined) priceExprs.push({ $lte: [effective, maxPrice] });
  if (priceExprs.length) {
    filter.$expr = priceExprs.length === 1 ? priceExprs[0] : { $and: priceExprs };
  }

  const q = req.query.q ? String(req.query.q).trim() : "";

  // Search strategy (Slice 8): $text first — the INDEX (stemmed,
  // weighted, relevance-ranked). If it matches nothing, fall back to
  // the name regex — the SCAN (partials work, no ranking).
  if (q) {
    const textFilter = { ...filter, $text: { $search: q } };
    // Whole-result-set gate: page 2 of a text-matched query stays on
    // the text path even when that page is empty.
    const total = await Product.countDocuments(textFilter);
    if (total > 0) {
      const products = await runPublicListing(
        textFilter,
        explicitSort ?? { _score: { $meta: "textScore" } as const, _id: 1 },
        paging
      );
      res.json({ ...pageMeta(total, paging), products });
      return;
    }
    // Fallback SCAN for partials — escaped, so punctuation never
    // crashes the public search box (review catch: q="(" was a 500).
    filter.name = { $regex: escapeRegex(q), $options: "i" };
  }

  const [products, total] = await Promise.all([
    runPublicListing(filter, explicitSort ?? { createdAt: -1, _id: -1 }, paging),
    Product.countDocuments(filter),
  ]);

  res.json({ ...pageMeta(total, paging), products });
});

/**
 * Related products (Slice 8): up to 4 same-category active siblings,
 * newest first, never the product itself. Uncategorized products have
 * no siblings — an empty list, never "random products".
 */
export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) {
    throw httpError("Product not found", 404);
  }
  const product = await Product.findOne({ _id: id, isActive: true });
  if (!product) {
    throw httpError("Product not found", 404);
  }
  if (!product.category) {
    res.json([]);
    return;
  }
  const related = await Product.find({
    category: product.category,
    isActive: true,
    _id: { $ne: product._id },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(4);
  res.json(related);
});

/**
 * Admin catalog listing: every product regardless of status, with the
 * same query vocabulary as the public listing (q, page, limit) plus a
 * status filter (active | inactive | all, default all).
 */
export const getAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const paging = parsePagination(req);

  const filter: Record<string, unknown> = {};
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;
  if (req.query.q) {
    filter.name = { $regex: escapeRegex(String(req.query.q).trim()), $options: "i" };
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Product.countDocuments(filter),
  ]);

  res.json({ ...pageMeta(total, paging), products });
});

/**
 * Admin product detail: unlike the public detail, inactive products
 * are visible — the owner must be able to open and edit archived items.
 */
export const getAdminProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id).populate("category", "name");
  if (!product) {
    throw httpError("Product not found", 404);
  }
  res.json(product);
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) {
    throw httpError("Product not found", 404);
  }
  res.json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw httpError("Product not found", 404);
  }
  const { name, description, price, discountPrice, stock, category, images, isActive } =
    req.body as ProductBody;

  const axis = validateProductData(req.body as ProductBody, {
    price: product.price,
    discountPrice: product.discountPrice,
  });

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (discountPrice !== undefined) product.discountPrice = discountPrice ?? undefined;
  if (stock !== undefined) product.stock = stock;
  // Axis writes are full-replace; they also own the stock sum.
  if (axis.optionName !== undefined) {
    product.optionName = axis.optionName ?? undefined;
    product.variants = axis.variants ?? undefined;
    if (axis.stock !== undefined) product.stock = axis.stock;
  } else if (product.variants?.length && stock !== undefined) {
    // Client-sent stock cannot desync a variant product's sum.
    product.stock = sumVariantStock(product.variants);
  }
  if (category !== undefined) product.category = category;
  if (images !== undefined) product.images = images;
  if (isActive !== undefined) product.isActive = isActive;

  await product.save();
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw httpError("Product not found", 404);
  }

  product.isActive = false;
  await product.save();
  res.json({ message: "Product deleted successfully" });
});
