// Slice 3 — the status→actions mapping, the UI mirror of the backend
// state machine. For each status, EXACTLY the legal actions render.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OrderStatusActions from "@/components/admin/OrderStatusActions";
import { OrderStatus } from "@/types/order";

const mount = (status: OrderStatus) => {
  const onAdvance = vi.fn();
  const onCancel = vi.fn();
  render(<OrderStatusActions status={status} onAdvance={onAdvance} onCancel={onCancel} />);
  return { onAdvance, onCancel };
};

describe("OrderStatusActions", () => {
  it("pending: advance to processing + cancel", () => {
    const { onAdvance } = mount("pending");
    fireEvent.click(screen.getByRole("button", { name: "Mark processing" }));
    expect(onAdvance).toHaveBeenCalledWith("processing");
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("processing: advance to shipped + cancel", () => {
    mount("processing");
    expect(screen.getByRole("button", { name: "Mark shipped" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("shipped: deliver only — no cancel (shipped goods can only complete)", () => {
    const { onCancel } = mount("shipped");
    expect(screen.getByRole("button", { name: "Mark delivered" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("delivered: no actions at all", () => {
    mount("delivered");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/final/i)).toBeTruthy();
  });

  it("cancelled: no actions at all", () => {
    mount("cancelled");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
