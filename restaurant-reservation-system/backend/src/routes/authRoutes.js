import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/csrf", issueCsrfToken);
router.post("/register", authLimiter, asyncHandler(auth.register));
router.post("/login", authLimiter, asyncHandler(auth.login));
router.post("/logout", requireAuth, asyncHandler(auth.logout));
router.get("/me", requireAuth, auth.me);
router.put("/profile", requireAuth, asyncHandler(auth.updateProfile));

export default router;
