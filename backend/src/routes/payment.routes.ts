import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  initPayment,
  handleIpn,
  paymentRedirect,
} from "../controllers/payment.controller";

const router = express.Router();

router.post("/init", requireAuth, initPayment);

// PUBLIC by necessity: the gateway server posts here (IPN) and the
// shopper's browser lands here (redirects). Neither carries our auth.
// Safety lives in the controller: server-to-server verification,
// amount match, idempotency, latest-tranId-only.
router.post("/ipn", handleIpn);
router.post("/redirect/:outcome", paymentRedirect);
router.get("/redirect/:outcome", paymentRedirect); // refresh/back resilience

export default router;
