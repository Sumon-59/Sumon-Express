// Tests for the image-upload seam (Slice 2b): the ProductForm's drop
// zone / file picker, with the HTTP layer mocked at the adapter level
// (same pattern as interceptor.test.ts). `api`'s adapter plays OUR
// backend (categories + the signature endpoint); the global axios
// adapter plays Cloudinary. No real network anywhere.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api";
import ProductForm from "@/components/admin/ProductForm";

type Config = InternalAxiosRequestConfig;

// Faithful fake adapter: rejects non-2xx with an AxiosError, like real
// axios adapters do (otherwise error paths never run).
const respond = (config: Config, status: number, data: unknown): Promise<AxiosResponse> => {
  const response: AxiosResponse = {
    config,
    status,
    statusText: String(status),
    headers: {},
    data,
  };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      String(status),
      config,
      null,
      response
    )
  );
};

const SIGNATURE = {
  cloudName: "test-cloud",
  apiKey: "test-api-key",
  timestamp: 1234567890,
  folder: "sumon-express/products",
  signature: "deadbeef",
};

// Our backend: categories for the form's mount fetch, signature for uploads.
const backendAdapter = async (config: Config) => {
  if (config.url?.endsWith("/categories")) return respond(config, 200, []);
  if (config.url?.endsWith("/admin/uploads/signature")) {
    return respond(config, 200, SIGNATURE);
  }
  return respond(config, 404, { message: "not found" });
};

const uploadFile = (file: File) => {
  fireEvent.change(screen.getByLabelText("Upload images"), {
    target: { files: [file] },
  });
};

const pngFile = (name = "photo.png") =>
  new File(["fake-png-bytes"], name, { type: "image/png" });

beforeEach(() => {
  api.defaults.adapter = backendAdapter;
});

describe("ProductForm image uploads", () => {
  it("uploads a dropped file to Cloudinary and lands its URL as a normal image row", async () => {
    const cloudinary = vi.fn(async (config: Config) =>
      respond(config, 200, { secure_url: "https://res.cloudinary.com/test-cloud/x.png" })
    );
    axios.defaults.adapter = cloudinary;

    render(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />);
    uploadFile(pngFile());

    // The secure_url appears in an editable URL input — indistinguishable
    // from a pasted row.
    await screen.findByDisplayValue("https://res.cloudinary.com/test-cloud/x.png");

    // The Cloudinary request went to the right place, WITHOUT our auth.
    expect(cloudinary).toHaveBeenCalledTimes(1);
    const config = cloudinary.mock.calls[0][0];
    expect(config.url).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    expect(config.headers?.Authorization).toBeUndefined();
    expect(config.withCredentials).not.toBe(true);
  });

  it("rejects a non-image before any request is made", async () => {
    const cloudinary = vi.fn();
    axios.defaults.adapter = cloudinary;
    const signature = vi.fn(backendAdapter);
    api.defaults.adapter = signature;

    render(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />);
    uploadFile(new File(["not an image"], "notes.pdf", { type: "application/pdf" }));

    await screen.findByText(/is not an image/);
    expect(cloudinary).not.toHaveBeenCalled();
    // Only the mount-time categories fetch — no signature request.
    const urls = signature.mock.calls.map((c) => c[0].url);
    expect(urls.some((u) => u?.includes("signature"))).toBe(false);
  });

  it("rejects a file over 5 MB before any request is made", async () => {
    const cloudinary = vi.fn();
    axios.defaults.adapter = cloudinary;

    render(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />);
    const big = pngFile("huge.png");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    uploadFile(big);

    await screen.findByText(/larger than 5 MB/);
    expect(cloudinary).not.toHaveBeenCalled();
  });

  it("shows an error on upload failure and leaves existing rows untouched", async () => {
    axios.defaults.adapter = async (config: Config) =>
      respond(config, 500, { error: { message: "boom" } });

    render(
      <ProductForm
        submitLabel="Save"
        onSubmit={vi.fn()}
        initial={{
          _id: "p1",
          name: "Widget",
          description: "d",
          price: 100,
          stock: 5,
          images: ["https://example.com/existing.png"],
        }}
      />
    );
    uploadFile(pngFile("bad.png"));

    await screen.findByText(/bad\.png/);
    await screen.findByText(/Request failed|boom|Upload failed/);
    // The pre-existing row is still there, untouched.
    expect(screen.getByDisplayValue("https://example.com/existing.png")).toBeTruthy();
  });

  it("disables submit while an upload is in flight", async () => {
    // Cloudinary that never answers: the upload stays in flight.
    axios.defaults.adapter = () => new Promise<AxiosResponse>(() => {});

    render(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />);
    uploadFile(pngFile());

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Uploading…/ });
      expect(button).toHaveProperty("disabled", true);
    });
  });
});
