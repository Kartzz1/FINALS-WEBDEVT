import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import { ROLES } from "../constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { syncLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Everything here needs a valid session AND the admin role, checked on the server.
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.post("/restaurants/sync", syncLimiter, asyncHandler(admin.startSync));
router.get("/restaurants/sync/status", asyncHandler(admin.syncStatus));

export default router;
