import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError.js";

function withoutUndefined(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );
}

// Callers always get copies, so they cannot change stored records by accident.
export function copyRecord(record, hidden = []) {
  if (!record) {
    return null;
  }
  const copy = structuredClone(record);
  for (const field of hidden) {
    delete copy[field];
  }
  return copy;
}

const byNewest = (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);

export function createMemoryRepository(
  records,
  { defaults = {}, hidden = [], uniqueKeys = [], createdAt = true, updatedAt = true } = {}
) {
  function assertUnique(candidate) {
    for (const keyOf of uniqueKeys) {
      const key = keyOf(candidate);
      for (const other of records.values()) {
        if (other.id !== candidate.id && keyOf(other) === key) {
          throw new AppError(409, "That value is already in use.");
        }
      }
    }
  }

  return {
    async create(data) {
      const now = new Date();
      const record = { ...defaults, ...withoutUndefined(data), id: randomUUID() };
      if (createdAt) {
        record.createdAt = now;
      }
      if (updatedAt) {
        record.updatedAt = now;
      }
      assertUnique(record);
      records.set(record.id, record);
      return copyRecord(record, hidden);
    },

    async findById(id) {
      return copyRecord(records.get(id), hidden);
    },

    async list({ filter = {}, page, limit }) {
      const conditions = Object.entries(withoutUndefined(filter));
      const matching = [...records.values()]
        .filter((record) => conditions.every(([key, value]) => record[key] === value))
        .sort(byNewest);
      const items = matching
        .slice((page - 1) * limit, page * limit)
        .map((record) => copyRecord(record, hidden));
      return { items, total: matching.length };
    },

    async update(id, changes) {
      const existing = records.get(id);
      if (!existing) {
        return null;
      }
      const updated = { ...existing, ...withoutUndefined(changes), id };
      if (updatedAt) {
        updated.updatedAt = new Date();
      }
      assertUnique(updated);
      records.set(id, updated);
      return copyRecord(updated, hidden);
    },

    async delete(id) {
      return records.delete(id);
    },
  };
}
