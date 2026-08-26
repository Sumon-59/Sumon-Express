const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../models/Product.model");
const User = require("../models/User.model");

async function seedProducts() {
  try {
    // Connect DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Find an admin/user to assign as createdBy
    const adminUser = await User.findOne();
    if (!adminUser) {
      throw new Error("No user found. Please register at least one user first.");
    }

    // Clear existing products (optional but recommended for demo)
    await Product.deleteMany({});
    console.log("Old products cleared");

    const demoProducts = [
      {
        name: "Wireless Mouse",
        description: "Ergonomic wireless mouse with long battery life",
        price: 799,
        stock: 50,
        images: ["https://via.placeholder.com/300"],
        createdBy: adminUser._id,
      },
      {
        name: "Mechanical Keyboard",
        description: "RGB mechanical keyboard with blue switches",
        price: 3499,
        discountPrice: 2999,
        stock: 30,
        images: ["https://via.placeholder.com/300"],
        createdBy: adminUser._id,
      },
      {
        name: "USB-C Cable",
        description: "Fast charging USB-C cable (1 meter)",
        price: 299,
        stock: 200,
        images: ["https://via.placeholder.com/300"],
        createdBy: adminUser._id,
      },
      {
        name: "Laptop Stand",
        description: "Adjustable aluminum laptop stand",
        price: 1299,
        stock: 40,
        images: ["https://via.placeholder.com/300"],
        createdBy: adminUser._id,
      },
      {
        name: "Noise Cancelling Headphones",
        description: "Over-ear ANC headphones with deep bass",
        price: 5999,
        stock: 15,
        images: ["https://via.placeholder.com/300"],
        createdBy: adminUser._id,
      },
    ];

    await Product.insertMany(demoProducts);
    console.log(`✅ ${demoProducts.length} demo products inserted`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error.message);
    process.exit(1);
  }
}

seedProducts();
