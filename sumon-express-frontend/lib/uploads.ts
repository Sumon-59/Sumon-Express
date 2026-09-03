import axios from "axios";
import { api } from "./api";

// Signed direct upload (Slice 2b): ask OUR backend for a signature
// (admin-gated), then send the file bytes straight to Cloudinary. The
// bytes never touch our server; the API secret never reaches the browser.

type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB — plenty for product photos

// Pre-flight check BEFORE any bytes move. Returns a user-facing problem
// string, or null when the file is uploadable.
export const validateImageFile = (file: File): string | null => {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" is not an image`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is larger than 5 MB`;
  }
  return null;
};

// Upload one image; resolves to its permanent https URL.
export const uploadProductImage = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> => {
  // 1) Our backend signs the upload (authenticated `api` instance).
  const { data: sig } = await api.post<UploadSignature>("/admin/uploads/signature");

  // 2) The signed params + file go directly to Cloudinary. PLAIN axios
  //    on purpose: our Bearer header and cookies must never be sent to
  //    a third-party server.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    form,
    {
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    }
  );

  const url: unknown = res.data?.secure_url;
  if (typeof url !== "string" || !url) {
    throw new Error("Upload failed: Cloudinary returned no URL");
  }
  return url;
};
