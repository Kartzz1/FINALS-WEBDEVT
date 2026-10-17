import { presentRestaurant } from "../presenters.js";
import * as restaurantService from "../services/restaurantService.js";
import { pageParams, toPage } from "../utils/pagination.js";
import { cityParam, cuisineParam, restaurantSchema, restaurantSearchQuery } from "../validators/schemas.js";
import { parseId, validate } from "../validators/validate.js";

const isAdmin = (req) => req.user?.role === "admin";

async function respondWithSearch(req, res, extra = {}) {
  const query = validate(req.query, restaurantSearchQuery, { coerce: true });
  const params = pageParams(query);
  const result = await restaurantService.searchRestaurants(req.user, { ...query, ...params, ...extra });
  const items = result.items.map((restaurant) => presentRestaurant(restaurant, { admin: isAdmin(req) }));
  res.status(200).json(toPage({ items, total: result.total }, params));
}

// GET /restaurants and GET /restaurants/search
export const listRestaurants = (req, res) => respondWithSearch(req, res);

// GET /restaurants/city/:city, for example /restaurants/city/Lipa
export async function listByCity(req, res) {
  const { city } = validate(req.params, cityParam);
  await respondWithSearch(req, res, { city });
}

// GET /restaurants/cuisine/:cuisine, for example /restaurants/cuisine/Japanese
export async function listByCuisine(req, res) {
  const { cuisine } = validate(req.params, cuisineParam);
  await respondWithSearch(req, res, { cuisine });
}

// Counts of cities, cuisines, and categories, for filters and the home page.
export async function getFacets(req, res) {
  res.status(200).json({ facets: await restaurantService.listFacets() });
}

export async function getRestaurant(req, res) {
  const restaurant = await restaurantService.getRestaurant(req.user, parseId(req.params.id));
  res.status(200).json({ restaurant: presentRestaurant(restaurant, { admin: isAdmin(req) }) });
}

export async function createRestaurant(req, res) {
  const restaurant = await restaurantService.createRestaurant(validate(req.body, restaurantSchema));
  res.status(201).json({ restaurant: presentRestaurant(restaurant, { admin: true }) });
}

export async function replaceRestaurant(req, res) {
  const id = parseId(req.params.id);
  const restaurant = await restaurantService.updateRestaurant(id, validate(req.body, restaurantSchema));
  res.status(200).json({ restaurant: presentRestaurant(restaurant, { admin: true }) });
}

export async function patchRestaurant(req, res) {
  const id = parseId(req.params.id);
  const changes = validate(req.body, restaurantSchema, { partial: true });
  const restaurant = await restaurantService.updateRestaurant(id, changes);
  res.status(200).json({ restaurant: presentRestaurant(restaurant, { admin: true }) });
}

export async function deleteRestaurant(req, res) {
  await restaurantService.deleteRestaurant(parseId(req.params.id));
  res.status(204).end();
}
