const express = require('express');
const router = express.Router();

const { registerUser, loginUser } = require('../controllers/auth.controller');
const { loginLimiter } = require("../middleware/rateLimit.middleware");


router.post("/login", loginLimiter, loginUser);
router.post("/register", registerUser);
router.post("/login", loginUser);

module.exports = router;