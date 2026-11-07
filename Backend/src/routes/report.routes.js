import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Rate limiter for patient report access OTP requests
const otpLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many verification attempts. Please try again after 15 minutes.",
});

// Passwordless Patient Report Access (No account registration required)
router.post("/request-otp", otpLimiter, reportController.requestPatientReportOtp);
router.post("/verify-otp", otpLimiter, reportController.verifyPatientReportOtp);

// Protected routes (Laboratory, Admin, or Patient access token)
router.use(authenticate);

router.post("/", authorize("lab"), reportController.createReport);
router.get("/", authorize("lab"), reportController.getLabReports);
router.get("/patient/:patientId", reportController.getPatientReports);
router.get("/:reportId", reportController.getReportById);
router.patch("/:reportId/publish", authorize("lab"), reportController.publishReport);
router.post("/:reportId/correct", authorize("lab"), reportController.correctReport);
router.get("/:reportId/download", reportController.downloadReport);

export default router;

