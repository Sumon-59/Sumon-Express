import { Request, Response } from "express";
import { Types } from "mongoose";
import Review from "../models/Review.model";
import Product from "../models/Product.model";
import Order from "../models/Order.model";
import asyncHandler from "../utils/asyncHandler";
import { sessionUser } from "../middleware/requireAuth";
import { httpError } from "../types/http.types";
import { parsePagination, pageMeta } from "../utils/pagination";

const COMMENT_MAX = 1000;

// The verified-purchase rule (Slice 9): eligible iff some DELIVERED
// order of theirs contains the product. Pipeline and cancelled orders
// don't count — delivery is when the product is truly theirs.
const hasDeliveredOrder = async (userId: Types.ObjectId, productId: string) =>
  (await Order.exists({
    user: userId,
    status: "delivered",
    "items.product": productId,
  })) !== null;

// Recompute-not-increment: the Review collection is the truth; the
// product's ratingAvg/ratingCount are a cached read. Any corruption
// self-heals on the next write.
const recomputeProductRating = async (productId: Types.ObjectId | string): Promise<void> => {
  const [agg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { product: new Types.ObjectId(String(productId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0,
        ratingCount: agg ? agg.count : 0,
      },
    }
  );
};

const validateRating = (rating: unknown): number => {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw httpError("rating must be a whole number from 1 to 5", 400);
  }
  return n;
};

const validateComment = (comment: unknown): string | undefined => {
  if (comment === undefined || comment === null) return undefined;
  if (typeof comment !== "string") {
    throw httpError(`comment must be text of at most ${COMMENT_MAX} characters`, 400);
  }
  // Trim FIRST, then cap and empty-check — whitespace neither counts
  // against the cap nor stores as an empty comment (review catch).
  const trimmed = comment.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > COMMENT_MAX) {
    throw httpError(`comment must be text of at most ${COMMENT_MAX} characters`, 400);
  }
  return trimmed;
};

const findActiveProduct = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw httpError("Product not found", 404);
  const product = await Product.findOne({ _id: id, isActive: true });
  if (!product) throw httpError("Product not found", 404);
  return product;
};

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const product = await findActiveProduct(String(req.params.id));
  const paging = parsePagination(req);

  const [reviews, total] = await Promise.all([
    Review.find({ product: product._id })
      .populate("user", "name") // name only — never the email
      .sort({ createdAt: -1, _id: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Review.countDocuments({ product: product._id }),
  ]);

  res.json({ ...pageMeta(total, paging), reviews });
});

export const getReviewEligibility = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const product = await findActiveProduct(String(req.params.id));

  const [canReview, existing] = await Promise.all([
    hasDeliveredOrder(user._id, String(product._id)),
    Review.exists({ user: user._id, product: product._id }),
  ]);

  res.json({ canReview, alreadyReviewed: existing !== null });
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const product = await findActiveProduct(String(req.params.id));

  const rating = validateRating((req.body as { rating?: unknown }).rating);
  const comment = validateComment((req.body as { comment?: unknown }).comment);

  if (!(await hasDeliveredOrder(user._id, String(product._id)))) {
    throw httpError("You can review a product once your order for it is delivered", 403);
  }

  const existing = await Review.exists({ user: user._id, product: product._id });
  if (existing) {
    throw httpError("You have already reviewed this product — edit your review instead", 400);
  }

  // The unique index backstops a race here: the loser gets E11000 →
  // the middleware's friendly 400.
  const review = await Review.create({
    user: user._id,
    product: product._id,
    rating,
    comment,
    verifiedPurchase: true,
  });
  await recomputeProductRating(product._id);

  res.status(201).json(review);
});

const findOwnReview = async (req: Request) => {
  const user = sessionUser(req);
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw httpError("Review not found", 404);
  const review = await Review.findById(id);
  if (!review) throw httpError("Review not found", 404);
  if (review.user.toString() !== user._id.toString()) {
    throw httpError("You can only change your own review", 403);
  }
  return review;
};

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await findOwnReview(req);
  const body = req.body as { rating?: unknown; comment?: unknown };

  if (body.rating !== undefined) review.rating = validateRating(body.rating);
  if (body.comment !== undefined) review.comment = validateComment(body.comment);

  await review.save();
  await recomputeProductRating(review.product);
  res.json(review);
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await findOwnReview(req);
  await review.deleteOne();
  await recomputeProductRating(review.product);
  res.json({ message: "Review deleted" });
});
