const express = require("express");
const router = express.Router();

const protect = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/admin.middleware');

const {
    createProduct,
    getProductById,
    getProducts,
    updateProduct,
    deleteProduct,
} = require('../controllers/product.controller');

router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", protect, isAdmin, createProduct);
router.put("/:id", protect, isAdmin, updateProduct);
router.delete("/:id", protect, isAdmin, deleteProduct);

module.exports = router;