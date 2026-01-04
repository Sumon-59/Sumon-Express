const User = require('../models/User.model');

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already exists' });
        }

        const user = await User.create({ name, email, password });
        res.status(201).json({ 
            message: 'User registered successfully',
            user: {
            userId: user._id, 
            name: user.name, 
            email: user.email 
            },
    });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    registerUser,
};