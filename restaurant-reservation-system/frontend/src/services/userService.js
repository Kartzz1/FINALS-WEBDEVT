import { api } from "./api.js";

export const userService = {
  list: (query) => api.get("/users", query),
  create: (body) => api.post("/users", body),
  update: (id, body) => api.put(`/users/${id}`, body),
  remove: (id) => api.delete(`/users/${id}`),
};
