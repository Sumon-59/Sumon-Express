import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  refreshToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Now that every consumer is TypeScript, models use `export default`
// (+ named type exports above). The idempotent guard from Slice 0 stays.
const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", userSchema);

export default User;
