import { presentReservation } from "../presenters.js";
import * as reservationService from "../services/reservationService.js";
import { pageParams, toPage } from "../utils/pagination.js";
import {
  availabilityQuery,
  reservationCreateSchema,
  reservationListQuery,
  reservationPatchSchema,
  reservationReplaceSchema,
} from "../validators/schemas.js";
import { parseId, validate } from "../validators/validate.js";

async function named(reservation) {
  const [withNames] = await reservationService.withNames([reservation]);
  return presentReservation(withNames);
}

export async function listReservations(req, res) {
  const query = validate(req.query, reservationListQuery, { coerce: true });
  const params = pageParams(query);
  const result = await reservationService.listReservations(req.user, {
    ...params,
    restaurantId: query.restaurantId,
    tableId: query.tableId,
    status: query.status,
  });
  const items = (await reservationService.withNames(result.items)).map(presentReservation);
  res.status(200).json(toPage({ items, total: result.total }, params));
}

export async function createReservation(req, res) {
  const input = validate(req.body, reservationCreateSchema);
  const reservation = await reservationService.createReservation(req.user, input);
  res.status(201).json({ reservation: await named(reservation) });
}

export async function getReservation(req, res) {
  const reservation = await reservationService.getReservation(req.user, parseId(req.params.id));
  res.status(200).json({ reservation: await named(reservation) });
}

export async function replaceReservation(req, res) {
  const id = parseId(req.params.id);
  const changes = validate(req.body, reservationReplaceSchema);
  const reservation = await reservationService.updateReservation(req.user, id, changes);
  res.status(200).json({ reservation: await named(reservation) });
}

export async function patchReservation(req, res) {
  const id = parseId(req.params.id);
  const changes = validate(req.body, reservationPatchSchema, { partial: true });
  const reservation = await reservationService.updateReservation(req.user, id, changes);
  res.status(200).json({ reservation: await named(reservation) });
}

export async function deleteReservation(req, res) {
  await reservationService.deleteReservation(req.user, parseId(req.params.id));
  res.status(204).end();
}

export async function searchAvailability(req, res) {
  const query = validate(req.query, availabilityQuery, { coerce: true });
  const tables = await reservationService.findAvailableTables(req.user, query);
  res.status(200).json({ tables });
}
