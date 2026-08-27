import { Request, Response } from "express";
import Category from "../models/Category.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

interface CategoryBody {
  name?: string;
  isActive?: boolean;
}

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as CategoryBody;

  if (!name) {
    throw httpError("Category name is required", 400);
  }

  const existingCategory = await Category.findOne({ name });
  if (existingCategory) {
    throw httpError("Category already exists", 409);
  }

  const category = await Category.create({ name });
  res.status(201).json(category);
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.json(categories);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, isActive } = req.body as CategoryBody;
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw httpError("Category not found", 404);
  }

  if (name !== undefined) category.name = name;
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();
  res.json(category);
});
