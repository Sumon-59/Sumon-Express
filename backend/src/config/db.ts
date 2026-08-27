import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  // Strict mode again: MONGO_URI is `string | undefined` until we check.
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed");
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;
