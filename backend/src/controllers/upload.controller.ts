import { Request, Response } from "express";
import { createHash } from "node:crypto";
import asyncHandler from "../utils/asyncHandler";
import { requireEnv } from "../utils/token";

// Signed direct upload (Slice 2b): the browser sends file bytes straight
// to Cloudinary; our only job is to SIGN the upload parameters with the
// API secret — which never leaves this server. The folder is signed, so
// the browser cannot redirect uploads anywhere else.
const UPLOAD_FOLDER = "sumon-express/products";

// Cloudinary's signing scheme: the signed params as key=value pairs,
// sorted alphabetically, joined with "&", the API secret appended, then
// SHA-1 hex. We sign exactly two params: folder and timestamp.
export const getUploadSignature = asyncHandler(async (req: Request, res: Response) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(
      `folder=${UPLOAD_FOLDER}&timestamp=${timestamp}` +
        requireEnv("CLOUDINARY_API_SECRET")
    )
    .digest("hex");

  res.json({
    cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requireEnv("CLOUDINARY_API_KEY"),
    timestamp,
    folder: UPLOAD_FOLDER,
    signature,
  });
});
