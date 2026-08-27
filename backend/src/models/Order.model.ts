import mongoose, { Schema, Model, Types } from "mongoose";

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Type guard: proves to the compiler a plain string is an OrderStatus.
export const isOrderStatus = (s: string): s is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(s);

export type PaymentMethod = "cod" | "bkash" | "nagad" | "rocket" | "card";

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder {
  user: Types.ObjectId;
  items: IOrderItem[];
  totalPrice: number;
  shippingAddress?: {
    address?: string;
    city?: string;
    phone?: string;
  };
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  isPaid: boolean;
  paidAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: "user" | "admin";
  createdAt?: Date;
  updatedAt?: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    totalPrice: {
      type: Number,
      required: true,
    },

    shippingAddress: {
      address: { type: String },
      city: { type: String },
      phone: { type: String },
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "bkash", "nagad", "rocket", "card"],
      default: "cod",
    },

    status: {
      type: String,
      enum: [...ORDER_STATUSES],
      default: "pending",
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    paidAt: Date,
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ["user", "admin"],
    },
  },
  { timestamps: true }
);

const Order: Model<IOrder> =
  (mongoose.models.Order as Model<IOrder>) || mongoose.model<IOrder>("Order", orderSchema);

export default Order;
