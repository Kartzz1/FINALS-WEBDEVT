import { api } from "./api.js";

export const catalogService = {
  // Public: browse and search restaurants stored in MongoDB.
  searchRestaurants: (params) => api.get("/restaurants", params),
  listRestaurants: (params) => api.get("/restaurants", params),
  getRestaurant: (id) => api.get(`/restaurants/${id}`),
  facets: () => api.get("/restaurants/facets"),

  // Administrators
  createRestaurant: (body) => api.post("/restaurants", body),
  updateRestaurant: (id, body) => api.patch(`/restaurants/${id}`, body),
  deleteRestaurant: (id) => api.delete(`/restaurants/${id}`),
  startSync: (body) => api.post("/admin/restaurants/sync", body),
  syncStatus: () => api.get("/admin/restaurants/sync/status"),

  listTables: (query) => api.get("/tables", query),
  createTable: (body) => api.post("/tables", body),
  updateTable: (id, body) => api.patch(`/tables/${id}`, body),
  deleteTable: (id) => api.delete(`/tables/${id}`),
};
