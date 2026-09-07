import { Request } from "express";

// One home for listing pagination (rule-of-three extraction, Slice 4):
// every admin listing parses page/limit the same way and answers the
// same {page, pages, total, <rows>} wrapper. Parsing and math live
// here so the listings can't drift apart.

export type Pagination = { page: number; limit: number; skip: number };

export const parsePagination = (req: Request, defaultLimit = 10): Pagination => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
};

// The wrapper's meta fields; callers spread it next to their rows key:
//   res.json({ ...pageMeta(total, p), products })
export const pageMeta = (total: number, { page, limit }: Pagination) => ({
  page,
  pages: Math.ceil(total / limit),
  total,
});
