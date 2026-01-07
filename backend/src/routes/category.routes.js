const express = require("express");
const router = express.Router();

const {
    createCategory,
    getCategories,
    updateCategory,
} = require("../controllers/category.controller");

const protect = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/admin.middleware");

router.get("/", getCategories);

router.post("/", protect, isAdmin, createCategory);
router.put("/:id", protect, isAdmin, updateCategory);

module.exports = router;