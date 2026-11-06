import { Router } from "express";
import * as patientController from "../controllers/patient.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);
router.use(authorize("lab", "admin"));

router.post("/", patientController.createPatient);
router.get("/", patientController.getPatients);
router.get("/reference/:code", patientController.getPatientByLabReference);
router.get("/:patientId", patientController.getPatientById);
router.patch("/:patientId", patientController.updatePatient);
router.get("/:patientId/calculations", patientController.getPatientCalculations);

export default router;
