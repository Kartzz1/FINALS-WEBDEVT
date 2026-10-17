import { api } from "./api.js";

export const authService = {
  me: () => api.get("/auth/me"),
  login: (body) => api.post("/auth/login", body),
  register: (body) => api.post("/auth/register", body),
  logout: () => api.post("/auth/logout", {}),
  updateProfile: (body) => api.put("/auth/profile", body),
};
