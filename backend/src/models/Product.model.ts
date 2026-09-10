import mongoose, { Schema, Model, Types } from "mongoose";

// One value of a product's single option axis (Slice 7). Multi-axis
// combinations are out of scope by plan decision D7.
export interface IProductVariant {
  name: string; // e.g. "M"
  stock: number;
  price?: number | null; // override: beats discountPrice AND price
}

export interface IProduct {
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  // On a variant product this is the SUM of value stocks — maintained
  // atomically alongside every value-stock change (never synced after
  // the fact) and recomputed on admin axis writes.
  stock: number;
  optionName?: string; // e.g. "Size"; absent = plain product
  variants?: IProductVariant[];
  // ObjectId in the database; controllers may assign the incoming id
  // string and Mongoose casts it — the union keeps both sides honest.
  category?: Types.ObjectId | string;
  images: string[];
  isActive: boolean;
  createdBy: Types.ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discountPrice: {
      type: Number,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    optionName: {
      type: String,
      trim: true,
    },
    variants: {
      type: [
        new Schema<IProductVariant>(
          {
            name: { type: String, required: true, trim: true },
            stock: { type: Number, required: true, default: 0 },
            price: { type: Number, default: null },
          },
          { _id: false }
        ),
      ],
      default: undefined, // absent on plain products
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    images: [
      {
        type: String,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Product: Model<IProduct> =
  (mongoose.models.Product as Model<IProduct>) ||
  mongoose.model<IProduct>("Product", productSchema);

export default Product;
