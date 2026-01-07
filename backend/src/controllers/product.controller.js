const Product = require("../models/Product.model");
const asyncHandler = require("../utils/asyncHandler");

const createProduct = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        price,
        discountPrice,
        stock,
        category,
        images,
    } = req.body;

    if (!name || !description || price=== undefined || stock=== undefined) {
        const error = new Error("Please provide all required fields");
        error.statusCode = 400;
        throw error;
    }

    const product = await Product.create({
        name,
        description,
        price,
        discountPrice,
        stock,
        category,
        images,
        createdBy: req.user?._id || req.user,
    });
    res.status(201).json(product);
});

const getProducts = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sort = { createdAt: -1 }; // default sort by newest
    if (req.query.sort === "price_asc") sort = { price: 1 };
    if (req.query.sort === "price_desc") sort = { price: -1 };

    const filter = { isActive: true };

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

const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive)  {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
    } 
    res.json(product);
});
module.exports = {
    createProduct,
    getProducts,
    getProductById,
};