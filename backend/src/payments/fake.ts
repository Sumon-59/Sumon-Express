import { PaymentProvider } from "./provider";

// The test double — mirrors the real contract EXACTLY: it attests what
// "the gateway" says (echoing fields the test planted in the IPN body),
// and the controller's judgment stays identical for fake and real.
// Convention (documented in tests/payments.test.js):
//   fake_verdict: "valid" | anything-else → verified true/false
//   amount, status, tran_id → echoed as the gateway's answer.
export const fakeProvider: PaymentProvider = {
  name: "fake",

  async createSession(_order, tranId) {
    return { redirectUrl: `https://fake.gateway.test/pay/${tranId}` };
  },

  async verifyIpn(body) {
    return {
      verified: body.fake_verdict === "valid",
      tranId: String(body.tran_id ?? ""),
      amount: Number(body.amount ?? NaN),
      status: String(body.status ?? ""),
    };
  },
};
