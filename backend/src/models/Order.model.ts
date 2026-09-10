import mongoose, { Schema, Model, Types } from "mongoose";
import { DISCOUNT_TYPES, DiscountType } from "./Discount.model";

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

// "online" is the one gateway door (SSLCommerz serves cards/bKash/Nagad
// behind it, Slice 11); the legacy instrument values stay valid on old
// documents. New checkouts send "cod" or "online".
export type PaymentMethod = "cod" | "online" | "bkash" | "nagad" | "rocket" | "card";

// Receipt of the LATEST online payment attempt (absent on COD orders).
// isPaid stays the one paid-flag every surface reads — this subdoc
// records how the attempt went, never decides paidness by itself.
export interface IOrderPayment {
  provider: string; // "sslcommerz" | "fake"
  tranId: string; // gateway transaction id — only the latest is honored
  status: "initiated" | "paid" | "failed";
  failureReason?: string;
}

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  variantName?: string; // the chosen option value, e.g. "M" (Slice 7)
}

// Snapshot of the discount applied at order time (same philosophy as
// the items snapshot: history renders without a Discount lookup, and
// later edits to the code can't rewrite old receipts).
export interface IOrderDiscount {
  code: string;
  type: DiscountType;
  value: number;
  amount: number; // whole taka actually taken off
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
  payment?: IOrderPayment;
  discount?: IOrderDiscount;
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
    variantName: { type: String },
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
      enum: ["cod", "online", "bkash", "nagad", "rocket", "card"],
      default: "cod",
    },

    payment: {
      type: new Schema<IOrderPayment>(
        {
          provider: { type: String, required: true },
          tranId: { type: String, required: true },
          status: {
            type: String,
            enum: ["initiated", "paid", "failed"],
            required: true,
          },
          failureReason: { type: String },
        },
        { _id: false }
      ),
      default: undefined, // absent unless an online attempt was made
    },

    discount: {
      type: new Schema<IOrderDiscount>(
        {
          code: { type: String, required: true },
          type: { type: String, enum: DISCOUNT_TYPES, required: true },
          value: { type: Number, required: true },
          amount: { type: Number, required: true },
        },
        { _id: false }
      ),
      default: undefined, // absent unless a code was applied
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

// The IPN handler's lookup path (Slice 11): find the order that owns a
// gateway transaction id. Sparse — COD orders carry no payment subdoc.
orderSchema.index({ "payment.tranId": 1 }, { sparse: true });

const Order: Model<IOrder> =
  (mongoose.models.Order as Model<IOrder>) || mongoose.model<IOrder>("Order", orderSchema);

export default Order;
