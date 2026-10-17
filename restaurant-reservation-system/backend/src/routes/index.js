import { Router } from "express";
import { BOOKING } from "../config/booking.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { searchAvailability } from "../controllers/reservationController.js";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import healthRoutes from "./health.js";
import reservationRoutes from "./reservationRoutes.js";
import restaurantRoutes from "./restaurantRoutes.js";
import tableRoutes from "./tableRoutes.js";
import userRoutes from "./userRoutes.js";

const router = Router();

router.use("/health", healthRoutes);

// Public, non-secret booking settings so the client can show the same limits.
router.get("/config", (req, res) => {
  res.status(200).json({ booking: BOOKING });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/users", userRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/tables", tableRoutes);
router.use("/reservations", reservationRoutes);
router.get("/availability", requireAuth, asyncHandler(searchAvailability));

export default router;
