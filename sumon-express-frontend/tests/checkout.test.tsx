// Slice 5 — the checkout page's order payload at the component seam:
// an applied discount code must ride the POST /orders body. Auth and
// navigation are mocked; the cart is seeded through localStorage
// (exactly how CartProvider persists it); HTTP is faked at the
// adapter, as established.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api";
import { CartProvider } from "@/context/CartContext";
import CheckoutPage from "@/app/checkout/page";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { _id: "u1", name: "Test", role: "user" }, loading: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  localStorage.clear();
});

beforeEach(() => {
  localStorage.setItem(
    "cart_items_v1",
    JSON.stringify([{ productId: "p1", name: "Widget", price: 999, quantity: 1 }])
  );
});

const fillAddress = () => {
  fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "House 1" } });
  fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Dhaka" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "01700000000" } });
};

describe("checkout order payload", () => {
  it("sends the applied discount code with the order", async () => {
    const bodies: Record<string, unknown> = {};
    api.defaults.adapter = async (config: Config) => {
      const url = config.url ?? "";
      bodies[url] = config.data ? JSON.parse(String(config.data)) : null;
      if (url.endsWith("/discounts/preview")) {
        return respond(config, 200, {
          code: "EID10",
          subtotal: 999,
          discountAmount: 99,
          total: 900,
        });
      }
      if (url.endsWith("/orders")) return respond(config, 201, { _id: "o1" });
      return respond(config, 404, { message: "not found" });
    };

    render(
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    );

    fillAddress();
    fireEvent.change(screen.getByLabelText("Discount code"), { target: { value: "EID10" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    await screen.findByText(/you save/i);

    // The summary shows the SERVER's total:
    expect(screen.getByText("৳900")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(bodies["/orders"]).toBeTruthy();
    });
    expect(bodies["/orders"]).toMatchObject({
      discountCode: "EID10",
      items: [{ product: "p1", quantity: 1 }],
    });
  });

  it("sends no discountCode when none is applied", async () => {
    const bodies: Record<string, unknown> = {};
    api.defaults.adapter = async (config: Config) => {
      const url = config.url ?? "";
      bodies[url] = config.data ? JSON.parse(String(config.data)) : null;
      if (url.endsWith("/orders")) return respond(config, 201, { _id: "o1" });
      return respond(config, 404, { message: "not found" });
    };

    render(
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    );

    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(bodies["/orders"]).toBeTruthy();
    });
    expect(bodies["/orders"]).not.toHaveProperty("discountCode");
    expect(bodies["/orders"]).toMatchObject({ paymentMethod: "cod" });
  });

  it("online: posts the order, initiates payment, navigates to the gateway (Slice 11)", async () => {
    const bodies: Record<string, unknown> = {};
    api.defaults.adapter = async (config: Config) => {
      const url = config.url ?? "";
      bodies[url] = config.data ? JSON.parse(String(config.data)) : null;
      if (url.endsWith("/orders")) return respond(config, 201, { _id: "o1" });
      if (url.endsWith("/payments/init"))
        return respond(config, 200, { redirectUrl: "https://fake.gateway.test/pay/t1" });
      return respond(config, 404, { message: "not found" });
    };

    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    try {
      render(
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      );

      fillAddress();
      fireEvent.click(screen.getByLabelText(/pay online/i));
      fireEvent.click(screen.getByRole("button", { name: /place order & pay/i }));

      await waitFor(() => {
        expect(assign).toHaveBeenCalledWith("https://fake.gateway.test/pay/t1");
      });
      expect(bodies["/orders"]).toMatchObject({ paymentMethod: "online" });
      expect(bodies["/payments/init"]).toMatchObject({ orderId: "o1" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
