const jwt = require("jsonwebtoken");

/**
 * Generate short-lived access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

/**
 * Generate long-lived refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
