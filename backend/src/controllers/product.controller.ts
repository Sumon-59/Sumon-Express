import { Request, Response } from "express";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { sessionUser } from "../middleware/requireAuth";
import { httpError } from "../types/http.types";

interface ProductBody {
  name?: string;
  description?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  category?: string;
  images?: string[];
  isActive?: boolean;
}

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, price, discountPrice, stock, category, images } =
    req.body as ProductBody;

  if (!name || !description || price === undefined || stock === undefined) {
    throw httpError("Please provide all required fields", 400);
  }

  const product = await Product.create({
    name,
    description,
    price,
    discountPrice,
    stock,
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

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (discountPrice !== undefined) product.discountPrice = discountPrice;
  if (stock !== undefined) product.stock = stock;
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
