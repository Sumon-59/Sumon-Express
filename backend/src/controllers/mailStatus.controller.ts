import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import { getMailer, mailFrom } from "../mail/mailer";

// GET /api/admin/mail-status — the deploy-probe seam for Slice 13:
// shows WHICH mailer the runtime selected (console until a Resend key
// lands; resend after) without leaking any credential.
export const getMailStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ mailer: getMailer().name, from: mailFrom() });
});
