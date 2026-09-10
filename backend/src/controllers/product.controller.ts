import { Request, Response } from "express";
import { Types } from "mongoose";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { sessionUser } from "../middleware/requireAuth";
import { httpError } from "../types/http.types";
import { parsePagination, pageMeta } from "../utils/pagination";

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
): void => {
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
};

/**
 * The option-axis rules (Slice 7). The axis is all-or-nothing: an
 * optionName with at least one value, or neither field. Editing is
 * full-axis replace. Returns the fields to persist — for a variant
 * product, top-level stock is the SERVER-computed sum (client stock
 * ignored); null optionName+variants removes the axis.
 */
const validateVariantAxis = (
  data: ProductBody
): { optionName?: string | null; variants?: { name: string; stock: number; price?: number | null }[] | null; stock?: number } => {
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
    stock: variants.reduce((sum, v) => sum + v.stock, 0),
  };
};

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, price, discountPrice, stock, category, images } =
    req.body as ProductBody;

  if (!name) throw httpError("name is required", 400);
  if (!description) throw httpError("description is required", 400);
  if (price === undefined) throw httpError("price is required", 400);
  if (stock === undefined) throw httpError("stock is required", 400);

  validateProductData(req.body as ProductBody);
  const axis = validateVariantAxis(req.body as ProductBody);

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

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let sort: Record<string, 1 | -1> = { createdAt: -1 }; // default sort by newest
  if (req.query.sort === "price_asc") sort = { price: 1 };
  if (req.query.sort === "price_desc") sort = { price: -1 };

  const filter: Record<string, unknown> = { isActive: true };

  if (req.query.q) {
    filter.name = { $regex: String(req.query.q).trim(), $options: "i" };
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }

  const products = await Product.find(filter)
    .populate("category", "name")
    .sort(sort)
    .skip(skip)
    .limit(limit);
  const total = await Product.countDocuments(filter);

  res.json({
    page,
    pages: Math.ceil(total / limit),
    total,
    products,
  });
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
    filter.name = { $regex: String(req.query.q).trim(), $options: "i" };
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

  validateProductData(req.body as ProductBody, {
    price: product.price,
    discountPrice: product.discountPrice,
  });
  const axis = validateVariantAxis(req.body as ProductBody);

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
    product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
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
