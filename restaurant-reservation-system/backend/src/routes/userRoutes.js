import { Router } from "express";
import * as users from "../controllers/userController.js";
import { ROLES } from "../constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Every route below needs a valid session AND the admin role, checked on the server.
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/", asyncHandler(users.listUsers));
router.post("/", asyncHandler(users.createUser));
router.get("/:id", asyncHandler(users.getUser));
router.put("/:id", asyncHandler(users.replaceUser));
router.patch("/:id", asyncHandler(users.patchUser));
router.delete("/:id", asyncHandler(users.deleteUser));

export default router;
