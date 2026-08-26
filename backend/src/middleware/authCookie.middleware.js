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

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized, invalid payload" });
    }

    const user = await User.findById(userId).select("_id name email role refreshToken");
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ message: "Not authorized, session revoked" });
    }

    req.user = { _id: user._id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (e) {
    return res.status(500).json({ message: "Auth error" });
  }
};

module.exports = { protectCookie };
