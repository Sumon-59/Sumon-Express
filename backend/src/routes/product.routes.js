const express = require('express');
const router = express.Router();

const {
    createProduct,
    getProductById,
    getProducts,
} = require('../controllers/product.controller');

const protect = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/admin.middleware');

router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", protect, isAdmin, createProduct);
router.put("/:id", protect, isAdmin, updateProduct);

module.exports = router;