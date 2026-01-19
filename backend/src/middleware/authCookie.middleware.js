const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

/**
 * Cookie-based authentication middleware.
 * Expects refresh token in httpOnly cookie named "jwt".
 * Attaches req.user on success.
 */
const protectCookie = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Not authorized, invalid token" });
      }

      const userId = decoded.userId || decoded.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authorized, invalid payload" });
      }

      const user = await User.findById(userId).select("_id name email role");
      if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      req.user = user;
      next();
    });
  } catch (e) {
    return res.status(500).json({ message: "Auth error" });
  }
};

module.exports = { protectCookie };
