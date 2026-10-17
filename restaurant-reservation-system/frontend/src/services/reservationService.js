import { api } from "./api.js";

export const reservationService = {
  list: (query) => api.get("/reservations", query),
  get: (id) => api.get(`/reservations/${id}`),
  create: (body) => api.post("/reservations", body),
  update: (id, body) => api.patch(`/reservations/${id}`, body),
  remove: (id) => api.delete(`/reservations/${id}`),
  availability: (query) => api.get("/availability", query),
};
