import { IOrder } from "../models/Order.model";
import { httpError } from "../types/http.types";
import { fakeProvider } from "./fake";
import { sslcommerzProvider } from "./sslcommerz";

// The trust boundary of Slice 11, as an interface. A provider answers
// exactly one question at each end of a payment:
//   createSession — "gateway, get ready to charge THIS much; here is
//     where to send the shopper and the webhook";
//   verifyIpn — "gateway, is this webhook body true, and what do YOU
//     say was paid?" (server-to-server; the body itself is never
//     trusted — anyone can POST a webhook).
// The CONTROLLER then decides whether the gateway's answer matches the
// order (amount, tranId, not-already-paid). Providers attest; the
// controller judges.

export interface PaymentUrls {
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface IpnVerdict {
  verified: boolean; // did the GATEWAY confirm this webhook is genuine?
  tranId: string;
  amount: number; // what the gateway says was actually paid
  status: string; // gateway vocabulary: VALID/VALIDATED/FAILED/CANCELLED…
}

export interface PaymentProvider {
  name: string;
  createSession(
    order: IOrder & { _id: unknown },
    tranId: string,
    urls: PaymentUrls
  ): Promise<{ redirectUrl: string }>;
  verifyIpn(ipnBody: Record<string, unknown>): Promise<IpnVerdict>;
}

// Env-driven selection: tests always get the fake (deterministic, no
// network); production gets SSLCommerz once its credentials exist. The
// 503 is deliberate UX for the not-yet-configured window — a named
// answer, not a crash (the Cloudinary env pattern from Slice 2b).
export const getPaymentProvider = (): PaymentProvider => {
  if (process.env.NODE_ENV === "test") return fakeProvider;
  if (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD) {
    return sslcommerzProvider;
  }
  throw httpError("Online payments are not configured yet", 503);
};
