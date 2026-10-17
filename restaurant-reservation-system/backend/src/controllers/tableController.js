import { presentTable } from "../presenters.js";
import * as tableService from "../services/tableService.js";
import { pageParams, toPage } from "../utils/pagination.js";
import { tableCreateSchema, tableListQuery, tableUpdateSchema } from "../validators/schemas.js";
import { parseId, validate } from "../validators/validate.js";

export async function listTables(req, res) {
  const query = validate(req.query, tableListQuery, { coerce: true });
  const params = pageParams(query);
  const result = await tableService.listTables(req.user, {
    ...params,
    restaurantId: query.restaurantId,
    active: query.active,
  });
  res.status(200).json(toPage({ items: result.items.map(presentTable), total: result.total }, params));
}

export async function getTable(req, res) {
  const table = await tableService.getTable(req.user, parseId(req.params.id));
  res.status(200).json({ table: presentTable(table) });
}

export async function createTable(req, res) {
  const table = await tableService.createTable(validate(req.body, tableCreateSchema));
  res.status(201).json({ table: presentTable(table) });
}

export async function replaceTable(req, res) {
  const id = parseId(req.params.id);
  const table = await tableService.updateTable(id, validate(req.body, tableUpdateSchema));
  res.status(200).json({ table: presentTable(table) });
}

export async function patchTable(req, res) {
  const id = parseId(req.params.id);
  const changes = validate(req.body, tableUpdateSchema, { partial: true });
  const table = await tableService.updateTable(id, changes);
  res.status(200).json({ table: presentTable(table) });
}

export async function deleteTable(req, res) {
  await tableService.deleteTable(parseId(req.params.id));
  res.status(204).end();
}
