import { Router } from "express";
import * as orderController from "../controllers/order.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("lab"), orderController.createOrder);
router.get("/", authorize("lab"), orderController.getLabOrders);
router.get("/patient/:patientId", orderController.getPatientOrders);
router.get("/:orderId", orderController.getOrderById);
router.patch("/:orderId/status", authorize("lab"), orderController.updateOrderStatus);

export default router;

