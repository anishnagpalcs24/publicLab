import { Router } from "express";
import * as labController from "../controllers/lab.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const registrationLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many lab registration requests, please try again in 15 minutes",
});

// Middleware helper to optionally attach authenticated user if token present
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticate(req, res, next);
  }
  next();
};

// Public discovery
router.get("/", labController.getLabs);

// ---------------------------------------------------------------------------
// Lab Owner / Staff routes (defined BEFORE /:labId to avoid route collision)
// ---------------------------------------------------------------------------

// Lab profile & settings
router.get("/me", authenticate, authorize("lab", "admin"), labController.getMyLab);
router.patch("/me", authenticate, authorize("lab", "admin"), labController.updateMyLab);

// Lab dashboard
router.get("/me/dashboard", authenticate, authorize("lab", "admin"), labController.getLabDashboard);
router.get("/dashboard", authenticate, authorize("lab", "admin"), labController.getLabDashboard);

// Application status & resubmission
router.get("/application/status", authenticate, labController.getApplicationStatus);
router.post("/application/resubmit", authenticate, labController.resubmitApplication);

// Clinical Calculator
router.post("/calculator/calculate", authenticate, authorize("lab", "admin"), labController.calculateMetric);
router.post("/calculations", authenticate, authorize("lab", "admin"), labController.saveCalculation);
router.get("/calculations", authenticate, authorize("lab", "admin"), labController.getCalculations);
router.get("/calculations/:id", authenticate, authorize("lab", "admin"), labController.getCalculationById);

// Submit lab application (combined registration with owner account or authenticated user)
router.post("/", registrationLimiter, optionalAuth, labController.createLab);

// Public single lab profile
router.get("/:labId", labController.getLabById);

// Admin-specific lab management
router.get("/admin/applications", authenticate, authorize("admin"), labController.getLabApplications);
router.patch("/admin/applications/:labId/review", authenticate, authorize("admin"), labController.reviewLabApplication);
router.patch("/admin/:labId/suspend", authenticate, authorize("admin"), labController.suspendLab);
router.delete("/admin/:labId", authenticate, authorize("admin"), labController.deleteLab);

export default router;
