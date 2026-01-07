const Category = require("../models/Category.model");
const asyncHandler = require("../utils/asyncHandler");

const createCategory = asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name) {
        const error = new Error("Category name is required");
        error.statusCode = 400;
        throw error;
    }

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
        const error = new Error("Category already exists");
        error.statusCode = 409;
        throw error;
    }

    const category = await Category.create({ name });
    res.status(201).json(category);
});

const getCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.json(categories);
});

const  updateCategory = asyncHandler(async (req, res) => {
    const { name, isActive } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
        const error = new Error("Category not found");
        error.statusCode = 404;
        throw error;
    }

    if (name !== undefined) category.name = name;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    res.json(category);
});

module.exports = {
    createCategory,
    getCategories,
    updateCategory,
};
