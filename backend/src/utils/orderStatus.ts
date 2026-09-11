import { IOrder, OrderStatus } from "../models/Order.model";

// THE one door for status writes (Slice 12). Setting status and
// appending its timeline entry are one motion here, so `history` can
// never diverge from `status` — the same "invariants live in doors"
// shape as the cancel/stock rule. Callers still save() themselves
// (they bundle their own side writes: isPaid, cancelledAt, …).
export const recordStatus = (order: IOrder, status: OrderStatus) => {
  order.status = status;
  order.history.push({ status, at: new Date() });
};
