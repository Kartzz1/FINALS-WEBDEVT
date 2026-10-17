import { Router } from "express";
import * as tables from "../controllers/tableController.js";
import { ROLES } from "../constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = requireRole(ROLES.ADMIN);

router.use(requireAuth);

router.get("/", asyncHandler(tables.listTables));
router.get("/:id", asyncHandler(tables.getTable));
router.post("/", adminOnly, asyncHandler(tables.createTable));
router.put("/:id", adminOnly, asyncHandler(tables.replaceTable));
router.patch("/:id", adminOnly, asyncHandler(tables.patchTable));
router.delete("/:id", adminOnly, asyncHandler(tables.deleteTable));

export default router;
