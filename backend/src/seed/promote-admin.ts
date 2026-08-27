// Promote a user to admin by email. There is deliberately no public
// API route for this — role changes are an operator action.
//
// Usage (from backend/): npm run promote -- user@example.com
// Acts on whatever database MONGO_URI in .env points at — check first.

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.model";

async function promote(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run promote -- <email>");
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const result = await User.updateOne({ email }, { role: "admin" });
  if (result.matchedCount === 0) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✅ ${email} is now an admin`);
  process.exit(0);
}

promote();
