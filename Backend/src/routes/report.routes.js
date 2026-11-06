import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("lab"), reportController.createReport);
router.get("/", authorize("lab"), reportController.getLabReports);
router.get("/patient/:patientId", reportController.getPatientReports);
router.get("/:reportId", reportController.getReportById);
router.patch("/:reportId/publish", authorize("lab"), reportController.publishReport);
router.post("/:reportId/correct", authorize("lab"), reportController.correctReport);
router.get("/:reportId/download", reportController.downloadReport);

export default router;

