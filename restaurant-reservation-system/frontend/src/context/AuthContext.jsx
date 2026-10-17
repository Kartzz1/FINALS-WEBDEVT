import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setUnauthorizedHandler } from "../services/api.js";
import { authService } from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [serverDown, setServerDown] = useState(false);

  // The session cookie is HttpOnly, so the page cannot tell whether it is
  // logged in; it asks the server. A network failure or 5xx means the server
  // itself is unavailable, which is shown differently from "not logged in".
  const checkSession = useCallback(async () => {
    setChecking(true);
    try {
      const data = await authService.me();
      setUser(data.user);
      setServerDown(false);
    } catch (err) {
      setUser(null);
      setServerDown(err.status === 0 || err.status >= 500);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    setServerDown(false);
    return data.user;
  }, []);

  const register = useCallback(async (details) => {
    const data = await authService.register(details);
    setUser(data.user);
    setServerDown(false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, checking, serverDown, retry: checkSession, login, register, logout, updateUser: setUser }),
    [user, checking, serverDown, checkSession, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
