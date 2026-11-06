import { Router } from "express";
import * as subscriptionController from "../controllers/subscription.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize, requireActiveSubscription } from "../middleware/authorize.js";

const router = Router();

// Public plans
router.get("/plans", subscriptionController.getSubscriptionPlans);
router.get("/plans/:planId", subscriptionController.getSubscriptionPlanById);

// Protected subscription access check
router.get("/access/check", authenticate, authorize("lab"), requireActiveSubscription(), subscriptionController.checkPaidFeatureAccess);

// Protected subscription management
router.post("/", authenticate, authorize("lab"), subscriptionController.createSubscription);
router.get("/me", authenticate, authorize("lab"), subscriptionController.getMySubscriptions);
router.get("/:subscriptionId", authenticate, subscriptionController.getSubscriptionById);
router.post("/:subscriptionId/cancel", authenticate, authorize("lab"), subscriptionController.cancelSubscription);

export default router;
