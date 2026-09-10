import { PaymentProvider } from "./provider";
import { httpError } from "../types/http.types";
import { requireEnv } from "../utils/env";

// SSLCommerz — one integration serves cards, bKash, Nagad and the rest
// behind its hosted page. Sandbox by default; flip SSLCOMMERZ_SANDBOX
// to "false" to go live (same API shape, different host).
const baseUrl = () =>
  process.env.SSLCOMMERZ_SANDBOX === "false"
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";

export const sslcommerzProvider: PaymentProvider = {
  name: "sslcommerz",

  // gwprocess v4 session: we tell the gateway the amount and the four
  // callback URLs; it answers a hosted GatewayPageURL for the shopper.
  async createSession(order, tranId, urls) {
    const params = new URLSearchParams({
      store_id: requireEnv("SSLCOMMERZ_STORE_ID"),
      store_passwd: requireEnv("SSLCOMMERZ_STORE_PASSWD"),
      total_amount: String(order.totalPrice),
      currency: "BDT",
      tran_id: tranId,
      success_url: urls.successUrl,
      fail_url: urls.failUrl,
      cancel_url: urls.cancelUrl,
      ipn_url: urls.ipnUrl,
      shipping_method: "NO",
      product_name: order.items.map((i) => i.name).join(", ").slice(0, 255) || "Order",
      product_category: "general",
      product_profile: "general",
      // The gateway requires customer identity fields; the shopper's
      // real identity lives on OUR order — placeholders satisfy the API.
      cus_name: "Customer",
      cus_email: "customer@sumon-express.app",
      cus_add1: order.shippingAddress?.address ?? "N/A",
      cus_city: order.shippingAddress?.city ?? "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: order.shippingAddress?.phone ?? "01000000000",
    });

    const res = await fetch(`${baseUrl()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await res.json()) as {
      status?: string;
      GatewayPageURL?: string;
      failedreason?: string;
    };

    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw httpError(
        `Payment gateway refused the session${data.failedreason ? `: ${data.failedreason}` : ""}`,
        502
      );
    }
    return { redirectUrl: data.GatewayPageURL };
  },

  // The IPN body is untrusted input (anyone can POST it). Verification
  // is the server-to-server validator call keyed by the body's val_id —
  // only what the VALIDATOR answers counts as the gateway's word.
  async verifyIpn(body) {
    const valId = String(body.val_id ?? "");
    const tranId = String(body.tran_id ?? "");
    if (!valId) return { verified: false, tranId, amount: NaN, status: "NO_VAL_ID" };

    const query = new URLSearchParams({
      val_id: valId,
      store_id: requireEnv("SSLCOMMERZ_STORE_ID"),
      store_passwd: requireEnv("SSLCOMMERZ_STORE_PASSWD"),
      format: "json",
    });
    const res = await fetch(
      `${baseUrl()}/validator/api/validationserverAPI.php?${query.toString()}`
    );
    const data = (await res.json()) as {
      status?: string;
      tran_id?: string;
      amount?: string;
    };

    const status = data.status ?? "INVALID";
    return {
      verified: status === "VALID" || status === "VALIDATED",
      // The validator's word beats the IPN body on every field.
      tranId: data.tran_id ?? tranId,
      amount: Number(data.amount ?? NaN),
      status,
    };
  },
};
