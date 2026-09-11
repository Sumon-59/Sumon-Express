import { Request, Response } from "express";
import { PipelineStage, Types } from "mongoose";
import User from "../models/User.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { sessionUser } from "../middleware/requireAuth";
import { parsePagination, pageMeta } from "../utils/pagination";

// The customer census (Slice 4): computed IN the database with an
// aggregation pipeline — a conveyor belt of stages. For each role-user
// customer we join their non-cancelled orders ($lookup with an inner
// $match), then collapse the joined array into three scalars. Only the
// requested page of finished rows ever crosses the network.
//
// Cancelled orders count for nothing — one rule for all three columns.
const CENSUS_STAGES: PipelineStage[] = [
  { $match: { role: { $in: ["user", "staff"] } } }, // staff shop too (Slice 14)
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "user",
      as: "orders",
      pipeline: [{ $match: { status: { $ne: "cancelled" } } }],
    },
  },
  {
    $addFields: {
      orderCount: { $size: "$orders" },
      totalSpent: { $sum: "$orders.totalPrice" },
      // $max over an empty array is null — exactly what "never ordered"
      // should look like.
      lastOrderAt: { $max: "$orders.createdAt" },
    },
  },
  { $project: { name: 1, email: 1, role: 1, createdAt: 1, orderCount: 1, totalSpent: 1, lastOrderAt: 1 } },
];

// Closed sort set, like the orders status filter: unknown values are a
// client bug and answer 400, not a silent default.
const SORTS: Record<string, PipelineStage.Sort["$sort"]> = {
  spent: { totalSpent: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
};

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const sortKey = String(req.query.sort ?? "spent");
  const sort = SORTS[sortKey];
  if (!sort) {
    throw httpError(`Invalid sort. Must be one of: ${Object.keys(SORTS).join(", ")}`, 400);
  }

  const paging = parsePagination(req);
  const [customers, total] = await Promise.all([
    User.aggregate([
      ...CENSUS_STAGES,
      { $sort: sort },
      { $skip: paging.skip },
      { $limit: paging.limit },
    ]),
    User.countDocuments({ role: { $in: ["user", "staff"] } }),
  ]);

  res.json({ ...pageMeta(total, paging), customers });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) {
    throw httpError("Invalid customer id", 400);
  }

  const [customer] = await User.aggregate([
    { $match: { _id: new Types.ObjectId(id) } },
    ...CENSUS_STAGES,
  ]);

  if (!customer) {
    throw httpError("Customer not found", 404);
  }

  res.json(customer);
});

// PUT /api/admin/customers/:id/role — the ONE role write over HTTP
// (Slice 14). Closed set user|staff: an admin cannot mint another
// admin here (promotion to admin stays the CLI script), and cannot
// demote themselves (no lock-yourself-out foot-gun).
export const setCustomerRole = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw httpError("Customer not found", 404);

  const role = String((req.body as { role?: unknown })?.role ?? "");
  if (role !== "user" && role !== "staff") {
    throw httpError("Role must be user or staff", 400);
  }

  const caller = sessionUser(req);
  if (String(caller._id) === id) {
    throw httpError("You cannot change your own role", 400);
  }

  const target = await User.findById(id);
  if (!target || target.role === "admin") {
    // Admins are not customers; also refuses demoting an admin here.
    throw httpError(target ? "Admins are managed via the CLI" : "Customer not found", target ? 400 : 404);
  }

  target.role = role;
  await target.save();
  res.json({ _id: target._id, role: target.role });
});
