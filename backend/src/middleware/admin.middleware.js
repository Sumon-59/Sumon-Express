const User = require("../models/User.model");

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = isAdmin;
