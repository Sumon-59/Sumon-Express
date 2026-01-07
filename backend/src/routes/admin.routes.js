const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/admin.middleware");

router.get("/dashboard", protect, isAdmin, (req, res) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

module.exports = router;
