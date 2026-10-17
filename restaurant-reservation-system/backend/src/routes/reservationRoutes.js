import { Router } from "express";
import * as reservations from "../controllers/reservationController.js";
import { ROLES } from "../constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

// Ownership (a user only reaching their own reservations) is enforced in the
// reservation service; the role check here covers the admin-only operation.
router.get("/", asyncHandler(reservations.listReservations));
router.post("/", asyncHandler(reservations.createReservation));
router.get("/:id", asyncHandler(reservations.getReservation));
router.put("/:id", asyncHandler(reservations.replaceReservation));
router.patch("/:id", asyncHandler(reservations.patchReservation));
router.delete("/:id", requireRole(ROLES.ADMIN), asyncHandler(reservations.deleteReservation));

export default router;
