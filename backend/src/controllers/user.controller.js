const User = require ("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");

const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user).select("-password");
    if(!user){
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }
            
    res.json(user);
});

module.exports = { getProfile };