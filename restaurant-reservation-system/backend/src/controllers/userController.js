import { presentUser } from "../presenters.js";
import * as userService from "../services/userService.js";
import { pageParams, toPage } from "../utils/pagination.js";
import {
  userCreateSchema,
  userListQuery,
  userPatchSchema,
  userReplaceSchema,
} from "../validators/schemas.js";
import { parseId, validate } from "../validators/validate.js";

export async function listUsers(req, res) {
  const params = pageParams(validate(req.query, userListQuery, { coerce: true }));
  const result = await userService.listUsers(params);
  res.status(200).json(toPage({ items: result.items.map(presentUser), total: result.total }, params));
}

export async function createUser(req, res) {
  const user = await userService.createUser(validate(req.body, userCreateSchema));
  res.status(201).json({ user: presentUser(user) });
}

export async function getUser(req, res) {
  const user = await userService.getUser(parseId(req.params.id));
  res.status(200).json({ user: presentUser(user) });
}

export async function replaceUser(req, res) {
  const id = parseId(req.params.id);
  const user = await userService.updateUser(req.user, id, validate(req.body, userReplaceSchema));
  res.status(200).json({ user: presentUser(user) });
}

export async function patchUser(req, res) {
  const id = parseId(req.params.id);
  const changes = validate(req.body, userPatchSchema, { partial: true });
  const user = await userService.updateUser(req.user, id, changes);
  res.status(200).json({ user: presentUser(user) });
}

export async function deleteUser(req, res) {
  await userService.deleteUser(req.user, parseId(req.params.id));
  res.status(204).end();
}
