import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const adminLoginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many admin login attempts, please try again in 15 minutes",
});

// Public Fixed Admin Login Endpoint
router.post("/login", adminLoginLimiter, adminController.adminLogin);

// Protected Administrator APIs
router.use(authenticate);
router.use(authorize("admin"));

router.get("/dashboard", adminController.getDashboard);
router.get("/users", adminController.getUsers);
router.patch("/users/:userId/status", adminController.updateUserStatus);
router.delete("/users/:userId", adminController.deleteUser);
router.get("/labs/applications", adminController.getLabApplications);
router.patch("/labs/applications/:labId/review", adminController.reviewLabApplication);
router.patch("/labs/:labId/suspend", adminController.suspendLab);
router.delete("/labs/:labId", adminController.deleteLab);
router.get("/callbacks", adminController.getCallbacks);
router.get("/audit-logs", adminController.getAuditLogs);

export default router;

