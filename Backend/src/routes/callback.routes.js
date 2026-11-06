import { Router } from "express";
import * as callbackController from "../controllers/callback.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const callbackLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many callback requests submitted, please try again later",
});

// Public callback submission
router.post("/", callbackLimiter, callbackController.createCallback);

// Admin callback oversight
router.get("/", authenticate, authorize("admin"), callbackController.getCallbacks);
router.get("/:callbackId", authenticate, authorize("admin"), callbackController.getCallbackById);
router.patch("/:callbackId/status", authenticate, authorize("admin"), callbackController.updateCallbackStatus);
router.delete("/:callbackId", authenticate, authorize("admin"), callbackController.deleteCallback);

export default router;

