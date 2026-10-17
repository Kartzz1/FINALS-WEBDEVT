import { RESERVATION_STATUS, ROLES } from "../../constants.js";
import { normalizeEmail } from "../../utils/normalize.js";
import { compareRestaurants, matchesCriteria, normalizeCriteria } from "../restaurantSearch.js";
import { copyRecord, createMemoryRepository } from "./baseRepository.js";

const USER_HIDDEN_FIELDS = ["passwordHash"];
const TABLE_HIDDEN_FIELDS = ["bookingVersion"];

function createDatabase() {
  return {
    users: new Map(),
    sessions: new Map(),
    restaurants: new Map(),
    tables: new Map(),
    reservations: new Map(),
  };
}

function buildRepositories(db) {
  const usersBase = createMemoryRepository(db.users, {
    defaults: { role: ROLES.USER },
    hidden: USER_HIDDEN_FIELDS,
    uniqueKeys: [(user) => user.email],
    updatedAt: false,
  });

  const users = {
    ...usersBase,
    create: (data) => usersBase.create({ ...data, email: normalizeEmail(data.email) }),
    update: (id, changes) =>
      usersBase.update(
        id,
        changes.email ? { ...changes, email: normalizeEmail(changes.email) } : changes
      ),
    async findById(id, { withPassword = false } = {}) {
      return copyRecord(db.users.get(id), withPassword ? [] : USER_HIDDEN_FIELDS);
    },
    async findByEmail(email, { withPassword = false } = {}) {
      const wanted = normalizeEmail(email);
      const record = [...db.users.values()].find((user) => user.email === wanted);
      return copyRecord(record, withPassword ? [] : USER_HIDDEN_FIELDS);
    },
    async countByRole(role) {
      return [...db.users.values()].filter((user) => user.role === role).length;
    },
  };

  const sessionsBase = createMemoryRepository(db.sessions, {
    createdAt: false,
    updatedAt: false,
  });

  const sessions = {
    create: sessionsBase.create,
    findById: sessionsBase.findById,
    delete: sessionsBase.delete,
    async deleteByUserId(userId, { exceptId } = {}) {
      let deleted = 0;
      for (const session of [...db.sessions.values()]) {
        if (session.userId === userId && session.id !== exceptId) {
          db.sessions.delete(session.id);
          deleted += 1;
        }
      }
      return deleted;
    },
  };

  const restaurantsBase = createMemoryRepository(db.restaurants, {
    defaults: { active: true, cuisine: [], gallery: [], amenities: [], manualFields: [], profileScore: 0 },
    // Mirrors the unique partial index: restaurants without a provider id never collide.
    uniqueKeys: [(r) => (r.externalPlaceId ? `ext:${r.externalPlaceId}` : `none:${r.id}`)],
  });

  const restaurants = {
    ...restaurantsBase,

    async search(criteria) {
      const c = normalizeCriteria(criteria);
      const matching = [...db.restaurants.values()]
        .filter((restaurant) => matchesCriteria(restaurant, c))
        .sort((a, b) => compareRestaurants(a, b, c));
      const items = matching.slice((c.page - 1) * c.limit, c.page * c.limit).map((r) => copyRecord(r));
      return { items, total: matching.length };
    },

    async findByExternalIds(ids) {
      const wanted = new Set(ids);
      return [...db.restaurants.values()].filter((r) => wanted.has(r.externalPlaceId)).map((r) => copyRecord(r));
    },

    // Counts of the values people filter by, for active restaurants only.
    async facets() {
      const active = [...db.restaurants.values()].filter((r) => r.active);
      const tally = (values) => {
        const counts = new Map();
        for (const value of values) {
          if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return [...counts]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, 50);
      };
      return {
        cities: tally(active.map((r) => r.city)),
        cuisines: tally(active.flatMap((r) => r.cuisine ?? [])),
        categories: tally(active.map((r) => r.category)),
      };
    },
  };

  const tablesBase = createMemoryRepository(db.tables, {
    defaults: { active: true, bookingVersion: 0 },
    hidden: TABLE_HIDDEN_FIELDS,
    uniqueKeys: [(table) => `${table.restaurantId}:${table.label.trim().toLowerCase()}`],
  });

  const tables = {
    ...tablesBase,
    // { [restaurantId]: { count, seats, capacities } } for open tables only.
    async summaryByRestaurantIds(ids) {
      const wanted = new Set(ids);
      const summary = {};
      for (const table of db.tables.values()) {
        if (!table.active || !wanted.has(table.restaurantId)) continue;
        const entry = (summary[table.restaurantId] ??= { count: 0, seats: 0, capacities: [] });
        entry.count += 1;
        entry.seats += table.capacity;
        if (!entry.capacities.includes(table.capacity)) entry.capacities.push(table.capacity);
      }
      for (const entry of Object.values(summary)) entry.capacities.sort((a, b) => a - b);
      return summary;
    },
    async restaurantIdsWithActiveTables() {
      return [...new Set([...db.tables.values()].filter((t) => t.active).map((t) => t.restaurantId))];
    },
    async countByRestaurant(restaurantId) {
      return [...db.tables.values()].filter((t) => t.restaurantId === restaurantId).length;
    },
    async findByLabel(restaurantId, label) {
      const wanted = label.trim().toLowerCase();
      const record = [...db.tables.values()].find(
        (t) => t.restaurantId === restaurantId && t.label.trim().toLowerCase() === wanted
      );
      return copyRecord(record, TABLE_HIDDEN_FIELDS);
    },
    // Transactions are serialized in memory mode, so no real lock is needed.
    async lockForBooking(id) {
      return tablesBase.findById(id);
    },
  };

  const reservationsBase = createMemoryRepository(db.reservations, {
    defaults: { notes: "", status: RESERVATION_STATUS.CONFIRMED },
  });

  const reservations = {
    ...reservationsBase,

    async findConflicts({ restaurantId, tableId, startAt, endAt, excludeId }) {
      return [...db.reservations.values()]
        .filter(
          (r) =>
            r.status === RESERVATION_STATUS.CONFIRMED &&
            r.startAt < endAt &&
            r.endAt > startAt &&
            r.id !== excludeId &&
            (!restaurantId || r.restaurantId === restaurantId) &&
            (!tableId || r.tableId === tableId)
        )
        .map((r) => copyRecord(r));
    },

    async findUpcomingOrOngoing({ tableId, now }) {
      return [...db.reservations.values()]
        .filter(
          (r) =>
            r.tableId === tableId &&
            r.status === RESERVATION_STATUS.CONFIRMED &&
            r.endAt > now
        )
        .map((r) => copyRecord(r));
    },

    async existsForTable(tableId) {
      return [...db.reservations.values()].some((r) => r.tableId === tableId);
    },

    async existsForUser(userId) {
      return [...db.reservations.values()].some((r) => r.userId === userId);
    },
  };

  return { users, sessions, restaurants, tables, reservations };
}

export function createMemoryStore() {
  const db = createDatabase();
  const repositories = buildRepositories(db);
  let queue = Promise.resolve();

  function snapshot() {
    return Object.fromEntries(
      Object.entries(db).map(([name, map]) => [name, structuredClone([...map.entries()])])
    );
  }

  function restore(saved) {
    for (const [name, entries] of Object.entries(saved)) {
      db[name].clear();
      for (const [id, record] of entries) {
        db[name].set(id, record);
      }
    }
  }

  return {
    ...repositories,

    async init() {},

    // Runs one transaction at a time and undoes its changes if fn throws,
    // which mimics what MongoDB gives us. Do not nest transactions: the inner
    // one would wait for the outer one to finish.
    transaction(fn) {
      const run = queue.then(async () => {
        const saved = snapshot();
        try {
          return await fn(repositories);
        } catch (err) {
          restore(saved);
          throw err;
        }
      });
      queue = run.catch(() => {});
      return run;
    },

    // For tests only.
    reset() {
      for (const map of Object.values(db)) {
        map.clear();
      }
    },
  };
}
