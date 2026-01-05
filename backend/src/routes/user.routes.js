const express = require('express');
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const { getProfile } = require("../controllers/user.controller");

router.get("/profile", protect, getProfile);

module.exports = router;