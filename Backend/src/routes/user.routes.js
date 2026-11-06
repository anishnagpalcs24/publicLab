import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.get("/me", userController.getMyProfile);
router.patch("/me", userController.updateMyProfile);
router.get("/:userId", authorize("admin"), userController.getUserById);
router.get("/", authorize("admin"), userController.getUsers);

export default router;

