import { PaymentProvider } from "./provider";

// The test double — attests what "the gateway" says (echoing fields
// the test planted in the IPN body), and the controller's judgment
// stays identical for fake and real. Convention (documented in
// tests/payments.test.js):
//   fake_verdict: "valid" | anything-else → verified true/false
//   amount, status → echoed as the gateway's answer
//   fake_validator_tran_id → what the VALIDATOR says the transaction
//     is (defaults to the body's tran_id) — lets tests drive the
//     cross-transaction replay the real validator makes possible.
// Honesty note: unlike the real provider (verified ⇔ VALID/VALIDATED),
// the fake lets verified and status diverge — deliberately, so tests
// can reach the controller's belt-and-braces branches.
export const fakeProvider: PaymentProvider = {
  name: "fake",

  async createSession(_order, tranId) {
    return { redirectUrl: `https://fake.gateway.test/pay/${tranId}` };
  },

  async verifyIpn(body) {
    return {
      verified: body.fake_verdict === "valid",
      tranId: String(body.fake_validator_tran_id ?? body.tran_id ?? ""),
      amount: Number(body.amount ?? NaN),
      status: String(body.status ?? ""),
    };
  },
};
