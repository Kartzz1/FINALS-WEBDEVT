import { Router } from "express";
import * as restaurants from "../controllers/restaurantController.js";
import { ROLES } from "../constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

// Anyone can browse and search. Signing in only adds what administrators may also see.
// Fixed paths come before /:id so "search" or "facets" are never read as an id.
router.get("/", optionalAuth, asyncHandler(restaurants.listRestaurants));
router.get("/search", optionalAuth, asyncHandler(restaurants.listRestaurants));
router.get("/facets", asyncHandler(restaurants.getFacets));
router.get("/city/:city", optionalAuth, asyncHandler(restaurants.listByCity));
router.get("/cuisine/:cuisine", optionalAuth, asyncHandler(restaurants.listByCuisine));
router.get("/:id", optionalAuth, asyncHandler(restaurants.getRestaurant));

router.post("/", ...adminOnly, asyncHandler(restaurants.createRestaurant));
router.put("/:id", ...adminOnly, asyncHandler(restaurants.replaceRestaurant));
router.patch("/:id", ...adminOnly, asyncHandler(restaurants.patchRestaurant));
router.delete("/:id", ...adminOnly, asyncHandler(restaurants.deleteRestaurant));

export default router;
