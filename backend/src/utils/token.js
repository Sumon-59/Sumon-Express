const jwt = require("jsonwebtoken");

const generateToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });

const generateRefreshToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expriresIn: "7d"});

module.exports = { generateToken, generateRefreshToken };