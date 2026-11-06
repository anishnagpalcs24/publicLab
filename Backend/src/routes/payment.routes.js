import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

// Webhook endpoint (public with provider cryptographic signature verification)
router.post("/webhook", paymentController.handlePaymentWebhook);

// Protected payment endpoints
router.post("/verify", authenticate, authorize("lab"), paymentController.verifyPayment);
router.post("/orders/:orderId", authenticate, authorize("lab"), paymentController.createOrderPayment);
router.post("/subscriptions/:subscriptionId", authenticate, authorize("lab"), paymentController.createSubscriptionPayment);
router.get("/orders/:orderId", authenticate, paymentController.getOrderPayments);
router.get("/subscriptions/:subscriptionId", authenticate, paymentController.getSubscriptionPayments);
router.get("/:paymentId", authenticate, paymentController.getPaymentById);

export default router;
