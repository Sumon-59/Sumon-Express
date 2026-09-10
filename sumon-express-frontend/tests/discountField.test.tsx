// Slice 5 — the checkout DiscountField at the component seam, HTTP
// faked at the adapter level (the established pattern). The component
// displays only what the SERVER computes; these tests pin that wiring.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api";
import DiscountField from "@/components/checkout/DiscountField";
import { DiscountPreview } from "@/types/discount";

type OnApplied = (preview: DiscountPreview | null) => void;

type Config = InternalAxiosRequestConfig;

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
    new AxiosError(`Request failed with status code ${status}`, String(status), config, null, response)
  );
};

const ITEMS = [{ product: "p1", quantity: 2 }];

const typeAndApply = (code: string) => {
  fireEvent.change(screen.getByLabelText("Discount code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
};

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe("DiscountField", () => {
  let onApplied: ReturnType<typeof vi.fn<OnApplied>>;
  beforeEach(() => {
    onApplied = vi.fn<OnApplied>();
  });

  it("applies a code: shows the server's saving and reports the preview upward", async () => {
    let sentBody: unknown;
    api.defaults.adapter = async (config: Config) => {
      sentBody = JSON.parse(String(config.data));
      return respond(config, 200, {
        code: "EID10",
        subtotal: 999,
        discountAmount: 99,
        total: 900,
      });
    };

    render(<DiscountField items={ITEMS} onApplied={onApplied} />);
    typeAndApply("eid10");

    await screen.findByText(/you save/i);
    expect(screen.getByText(/৳99/)).toBeTruthy();
    // The cart lines rode the request — the server computes from THEM:
    expect(sentBody).toMatchObject({ code: "eid10", items: ITEMS });
    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EID10", discountAmount: 99, total: 900 })
    );
  });

  it("shows the server's rejection message verbatim", async () => {
    api.defaults.adapter = async (config: Config) =>
      respond(config, 400, { message: "This discount code has expired" });

    render(<DiscountField items={ITEMS} onApplied={onApplied} />);
    typeAndApply("OLD10");

    await screen.findByText("This discount code has expired");
    expect(onApplied).toHaveBeenCalledWith(null);
  });

  it("remove resets the field and reports null upward", async () => {
    api.defaults.adapter = async (config: Config) =>
      respond(config, 200, { code: "EID10", subtotal: 999, discountAmount: 99, total: 900 });

    render(<DiscountField items={ITEMS} onApplied={onApplied} />);
    typeAndApply("EID10");
    await screen.findByText(/you save/i);

    fireEvent.click(screen.getByRole("button", { name: /remove discount code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Discount code")).toBeTruthy();
    });
    expect(onApplied).toHaveBeenLastCalledWith(null);
  });

  it("apply is disabled while the code box is empty", () => {
    render(<DiscountField items={ITEMS} onApplied={onApplied} />);
    expect(screen.getByRole("button", { name: /apply/i })).toHaveProperty("disabled", true);
  });
});
