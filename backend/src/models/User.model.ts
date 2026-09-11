import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: "user" | "staff" | "admin"; // staff (Slice 14): orders only
  refreshToken?: string;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
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
      enum: ["user", "staff", "admin"],
      default: "user",
    },

    refreshToken: {
      type: String,
    },

    // Password reset (Slice 14): only the SHA-256 of the emailed token
    // is stored — a DB leak exposes nothing usable. select:false keeps
    // it out of every ordinary query; cleared on successful reset.
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Now that every consumer is TypeScript, models use `export default`
// (+ named type exports above). The idempotent guard from Slice 0 stays.
const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", userSchema);

export default User;
