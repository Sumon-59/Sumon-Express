import "dotenv/config";
import mongoose from "mongoose";

import Product from "../models/Product.model";
import Category, { ICategory } from "../models/Category.model";
import User from "../models/User.model";
import { HydratedDocument } from "mongoose";

// Deterministic, reliable demo images
const img = (slug: string): string => `https://picsum.photos/seed/${slug}/600/600`;

async function seedProducts(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not set");

    await mongoose.connect(uri);
    console.log("MongoDB connected");

    // Find an admin/user to assign as createdBy
    const adminUser = await User.findOne();
    if (!adminUser) {
      throw new Error("No user found. Please register at least one user first.");
    }

    // Upsert categories
    const categoryNames = ["Electronics", "Accessories", "Home & Living", "Fashion"];
    const categories: Record<string, HydratedDocument<ICategory>> = {};
    for (const name of categoryNames) {
      const category = await Category.findOneAndUpdate(
        { name },
        { name, isActive: true },
        { upsert: true, new: true }
      );
      if (!category) throw new Error(`Failed to upsert category: ${name}`);
      categories[name] = category;
    }
    console.log(`✅ ${categoryNames.length} categories upserted`);

    // Clear existing products (demo reset)
    await Product.deleteMany({});
    console.log("Old products cleared");

    const demoProducts = [
      {
        name: "Wireless Mouse",
        description: "Ergonomic wireless mouse with silent clicks, adjustable DPI and up to 12 months of battery life.",
        price: 799,
        discountPrice: 649,
        stock: 50,
        category: categories["Electronics"]._id,
        images: [img("wireless-mouse")],
      },
      {
        name: "Mechanical Keyboard",
        description: "RGB mechanical keyboard with hot-swappable blue switches and a detachable USB-C cable.",
        price: 3499,
        discountPrice: 2999,
        stock: 30,
        category: categories["Electronics"]._id,
        images: [img("mech-keyboard")],
      },
      {
        name: "Noise Cancelling Headphones",
        description: "Over-ear ANC headphones with deep bass, transparency mode and 40-hour playtime.",
        price: 5999,
        discountPrice: 5199,
        stock: 15,
        category: categories["Electronics"]._id,
        images: [img("anc-headphones")],
      },
      {
        name: "Smart Watch",
        description: "1.8\" AMOLED display, heart-rate and SpO2 tracking, 7-day battery, IP68 water resistance.",
        price: 4499,
        stock: 25,
        category: categories["Electronics"]._id,
        images: [img("smart-watch")],
      },
      {
        name: "Bluetooth Speaker",
        description: "Portable speaker with 360° sound, 12-hour battery and IPX7 waterproofing.",
        price: 2499,
        discountPrice: 1999,
        stock: 40,
        category: categories["Electronics"]._id,
        images: [img("bt-speaker")],
      },
      {
        name: "USB-C Cable",
        description: "Fast charging 60W USB-C to USB-C braided cable, 1 meter.",
        price: 299,
        stock: 200,
        category: categories["Accessories"]._id,
        images: [img("usbc-cable")],
      },
      {
        name: "Laptop Stand",
        description: "Adjustable aluminum laptop stand with ventilation cutouts, fits 13–17\" laptops.",
        price: 1299,
        discountPrice: 1099,
        stock: 40,
        category: categories["Accessories"]._id,
        images: [img("laptop-stand")],
      },
      {
        name: "Power Bank 20000mAh",
        description: "Dual-port 22.5W fast-charging power bank with LED charge indicator.",
        price: 1899,
        stock: 60,
        category: categories["Accessories"]._id,
        images: [img("power-bank")],
      },
      {
        name: "Phone Case",
        description: "Shockproof transparent phone case with raised bezels and anti-yellowing coating.",
        price: 349,
        discountPrice: 249,
        stock: 150,
        category: categories["Accessories"]._id,
        images: [img("phone-case")],
      },
      {
        name: "LED Desk Lamp",
        description: "Dimmable LED desk lamp with three color temperatures and a USB charging port.",
        price: 1599,
        stock: 35,
        category: categories["Home & Living"]._id,
        images: [img("desk-lamp")],
      },
      {
        name: "Ceramic Coffee Mug Set",
        description: "Set of 4 matte ceramic mugs, 350ml each, dishwasher and microwave safe.",
        price: 999,
        discountPrice: 799,
        stock: 45,
        category: categories["Home & Living"]._id,
        images: [img("coffee-mugs")],
      },
      {
        name: "Cotton T-Shirt",
        description: "Premium 180 GSM combed cotton t-shirt, regular fit, available in solid colors.",
        price: 599,
        discountPrice: 449,
        stock: 120,
        category: categories["Fashion"]._id,
        images: [img("cotton-tshirt")],
      },
    ].map((p) => ({ ...p, createdBy: adminUser._id }));

    await Product.insertMany(demoProducts);
    console.log(`✅ ${demoProducts.length} demo products inserted`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

seedProducts();
