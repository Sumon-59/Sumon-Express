// Tests for the cart seam: the useCart() hook's public API.
//
// Same rules as the backend tests: we exercise only what components
// can see — items, total, and the action functions. renderHook mounts
// the hook inside its Provider, exactly like the app does in
// layout.tsx; act() wraps every state change, like React requires.

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "@/context/CartContext";

// Every test gets a fresh cart mounted inside its Provider.
function mountCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

const widget = { productId: "p1", name: "Widget", price: 100 };
const gadget = { productId: "p2", name: "Gadget", price: 250 };

describe("useCart", () => {
  it("starts empty", () => {
    const { result } = mountCart();
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("adds an item with quantity 1 by default", () => {
    const { result } = mountCart();

    act(() => result.current.addItem(widget));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
  });

  it("adding the same product again increases its quantity instead of duplicating", () => {
    const { result } = mountCart();

    act(() => result.current.addItem(widget));
    act(() => result.current.addItem(widget, 2));

    // still ONE line in the cart, with quantity 3 — not two lines
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it("computes the total across items (worked example: 100×2 + 250×1 = 450)", () => {
    const { result } = mountCart();

    act(() => result.current.addItem(widget, 2));
    act(() => result.current.addItem(gadget));

    expect(result.current.total).toBe(450);
  });

  it("updateQty changes quantity but never goes below 1", () => {
    const { result } = mountCart();
    act(() => result.current.addItem(widget));

    act(() => result.current.updateQty("p1", 5));
    expect(result.current.items[0].quantity).toBe(5);

    // a user clicking "minus" too many times must not reach 0 or -1
    act(() => result.current.updateQty("p1", 0));
    expect(result.current.items[0].quantity).toBe(1);
  });

  it("removeItem removes only that product", () => {
    const { result } = mountCart();
    act(() => result.current.addItem(widget));
    act(() => result.current.addItem(gadget));

    act(() => result.current.removeItem("p1"));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].productId).toBe("p2");
  });

  it("clearCart empties everything", () => {
    const { result } = mountCart();
    act(() => result.current.addItem(widget));
    act(() => result.current.addItem(gadget));

    act(() => result.current.clearCart());

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  // Slice 7: a line's identity is product+variant.
  it("keeps S and M of one product as separate lines", () => {
    const { result } = mountCart();

    act(() => result.current.addItem({ ...widget, variant: "S" }));
    act(() => result.current.addItem({ ...widget, variant: "M" }));

    expect(result.current.items).toHaveLength(2);
  });

  it("adding the same variant again bumps its quantity", () => {
    const { result } = mountCart();

    act(() => result.current.addItem({ ...widget, variant: "S" }));
    act(() => result.current.addItem({ ...widget, variant: "S" }, 2));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it("remove and updateQty target one variant line, not its siblings", () => {
    const { result } = mountCart();

    act(() => result.current.addItem({ ...widget, variant: "S" }));
    act(() => result.current.addItem({ ...widget, variant: "M" }));

    act(() => result.current.updateQty(widget.productId, 5, "M"));
    expect(result.current.items.find((x) => x.variant === "M")?.quantity).toBe(5);
    expect(result.current.items.find((x) => x.variant === "S")?.quantity).toBe(1);

    act(() => result.current.removeItem(widget.productId, "S"));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].variant).toBe("M");
  });

  it("legacy variant-less lines and variant lines of one product coexist", () => {
    const { result } = mountCart();

    act(() => result.current.addItem(widget)); // no variant (legacy shape)
    act(() => result.current.addItem({ ...widget, variant: "S" }));

    expect(result.current.items).toHaveLength(2);
    act(() => result.current.removeItem(widget.productId)); // removes ONLY the plain line
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].variant).toBe("S");
  });

  it("persists to localStorage so the cart survives a page refresh", () => {
    // First visit: add an item, then unmount (= close the tab)
    const first = mountCart();
    act(() => first.result.current.addItem(widget, 2));
    first.unmount();

    // Second visit: a brand-new mount must restore the same cart
    const second = mountCart();
    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0]).toMatchObject({
      productId: "p1",
      quantity: 2,
    });
  });
});
