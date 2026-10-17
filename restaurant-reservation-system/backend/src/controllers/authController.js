import { clearSessionCookie, setSessionCookie } from "../config/cookies.js";
import { presentUser } from "../presenters.js";
import * as authService from "../services/authService.js";
import { signSessionToken } from "../utils/tokens.js";
import { loginSchema, profileSchema, registerSchema } from "../validators/schemas.js";
import { validate } from "../validators/validate.js";

function startCookieSession(res, { user, session }) {
  setSessionCookie(res, signSessionToken({ userId: user.id, sessionId: session.id }));
}

export async function register(req, res) {
  const result = await authService.register(validate(req.body, registerSchema));
  startCookieSession(res, result);
  res.status(201).json({ user: presentUser(result.user) });
}

export async function login(req, res) {
  const result = await authService.login(validate(req.body, loginSchema));
  startCookieSession(res, result);
  res.status(200).json({ user: presentUser(result.user) });
}

export async function logout(req, res) {
  await authService.logout(req.sessionId);
  clearSessionCookie(res);
  res.status(204).end();
}

export function me(req, res) {
  res.status(200).json({ user: presentUser(req.user) });
}

export async function updateProfile(req, res) {
  const changes = validate(req.body, profileSchema);
  const user = await authService.updateProfile(req.user, req.sessionId, changes);
  res.status(200).json({ user: presentUser(user) });
}
