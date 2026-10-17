import mongoose from "mongoose";
import { LABEL_COLLATION, PRICE_RANGES, RESERVATION_STATUS } from "../../constants.js";
import { Reservation } from "../../models/Reservation.js";
import { Restaurant } from "../../models/Restaurant.js";
import { Session } from "../../models/Session.js";
import { Table } from "../../models/Table.js";
import { User } from "../../models/User.js";
import { normalizeEmail } from "../../utils/normalize.js";
import { SEARCH_TEXT_FIELDS, escapeRegex, normalizeCriteria, unknownLast } from "../restaurantSearch.js";
import { createBaseRepository, inSession, toEntity } from "./baseRepository.js";

const USER_HIDDEN_FIELDS = ["passwordHash"];
const TABLE_HIDDEN_FIELDS = ["bookingVersion"];

// Query operators inside filters must be wrapped in mongoose.trusted(),
// because the global sanitizeFilter option (see config/db.js) otherwise
// treats them as literal values.

function createUsersRepository(session) {
  const base = createBaseRepository(User, { session, hidden: USER_HIDDEN_FIELDS });

  async function findOneBy(filter, { withPassword = false } = {}) {
    let query = User.findOne(filter);
    if (withPassword) {
      query = query.select("+passwordHash");
    }
    const doc = await inSession(query.lean(), session);
    return toEntity(doc, withPassword ? [] : USER_HIDDEN_FIELDS);
  }

  return {
    ...base,
    create: (data) => base.create({ ...data, email: normalizeEmail(data.email) }),
    update: (id, changes) =>
      base.update(
        id,
        changes.email ? { ...changes, email: normalizeEmail(changes.email) } : changes
      ),
    findById: (id, options) => findOneBy({ _id: id }, options),
    findByEmail: (email, options) =>
      findOneBy({ email: normalizeEmail(email) }, options),
    async countByRole(role) {
      return inSession(User.countDocuments({ role }), session);
    },
  };
}

function createSessionsRepository(session) {
  const base = createBaseRepository(Session, { session });

  return {
    create: base.create,
    findById: base.findById,
    delete: base.delete,
    async deleteByUserId(userId, { exceptId } = {}) {
      const filter = { userId };
      if (exceptId) {
        filter._id = mongoose.trusted({ $ne: exceptId });
      }
      const result = await inSession(Session.deleteMany(filter), session);
      return result.deletedCount;
    },
  };
}

function createTablesRepository(session) {
  const base = createBaseRepository(Table, { session, hidden: TABLE_HIDDEN_FIELDS });

  return {
    ...base,
    // { [restaurantId]: { count, seats, capacities } } for open tables only.
    async summaryByRestaurantIds(ids) {
      const rows = await Table.aggregate([
        { $match: { restaurantId: { $in: ids }, active: true } },
        {
          $group: {
            _id: "$restaurantId",
            count: { $sum: 1 },
            seats: { $sum: "$capacity" },
            capacities: { $addToSet: "$capacity" },
          },
        },
      ]);
      return Object.fromEntries(
        rows.map((row) => [row._id, { count: row.count, seats: row.seats, capacities: row.capacities.sort((a, b) => a - b) }])
      );
    },
    async restaurantIdsWithActiveTables() {
      return Table.distinct("restaurantId", { active: true });
    },
    async countByRestaurant(restaurantId) {
      return inSession(Table.countDocuments({ restaurantId }), session);
    },
    async findByLabel(restaurantId, label) {
      const doc = await inSession(
        Table.findOne({ restaurantId, label: label.trim() })
          .collation(LABEL_COLLATION)
          .lean(),
        session
      );
      return toEntity(doc, TABLE_HIDDEN_FIELDS);
    },
    // Call inside a transaction before checking for conflicts. The write makes
    // concurrent bookings for the same table collide, so only one can commit.
    async lockForBooking(id) {
      const doc = await inSession(
        Table.findByIdAndUpdate(
          id,
          { $inc: { bookingVersion: 1 } },
          { new: true, timestamps: false }
        ).lean(),
        session
      );
      return toEntity(doc, TABLE_HIDDEN_FIELDS);
    },
  };
}

const NAME_COLLATION = { locale: "en", strength: 2 };
const MAX_FACET_ROWS = 50;

// Builds the MongoDB filter for a restaurant search. Values are escaped, and the
// aggregation pipeline is not sanitized by Mongoose, so operators are written plainly.
function buildRestaurantMatch(c) {
  const and = [];
  const exact = (value) => ({ $regex: `^${escapeRegex(value)}$`, $options: "i" });
  if (c.active !== undefined) and.push({ active: c.active });
  if (c.ids) and.push({ _id: { $in: c.ids } });
  if (c.city) and.push({ city: { $regex: `^${escapeRegex(c.city)}`, $options: "i" } });
  if (c.province) and.push({ province: exact(c.province) });
  if (c.category) and.push({ category: exact(c.category) });
  if (c.cuisine) and.push({ cuisine: exact(c.cuisine) });
  if (c.priceRanges) and.push({ priceRange: { $in: c.priceRanges } });
  if (c.minRating !== null) and.push({ rating: { $gte: c.minRating } });
  if (c.q) {
    const contains = { $regex: escapeRegex(c.q), $options: "i" };
    and.push({ $or: [...SEARCH_TEXT_FIELDS.map((field) => ({ [field]: contains })), { cuisine: contains }] });
  }
  return and.length ? { $and: and } : {};
}

function restaurantSortStage(c) {
  const d = c.direction;
  if (c.sort === "name") return { name: d, _id: 1 };
  if (c.sort === "newest") return { createdAt: -1, name: 1, _id: 1 };
  if (c.sort === "rating") return { _ratingKey: d, reviewCount: -1, name: 1, _id: 1 };
  if (c.sort === "price") return { _priceKey: d, name: 1, _id: 1 };
  return { _ratingKey: -1, profileScore: -1, name: 1, _id: 1 };
}

function createRestaurantsRepository(session) {
  const base = createBaseRepository(Restaurant, { session });

  return {
    ...base,

    async search(criteria) {
      const c = normalizeCriteria(criteria);
      const nulls = c.sort === "featured" ? -1 : unknownLast(c.direction);
      const pipeline = [
        { $match: buildRestaurantMatch(c) },
        {
          $addFields: {
            _ratingKey: { $ifNull: ["$rating", nulls] },
            _priceKey: {
              $cond: [{ $in: ["$priceRange", PRICE_RANGES] }, { $strLenCP: "$priceRange" }, unknownLast(c.direction)],
            },
          },
        },
        { $sort: restaurantSortStage(c) },
        {
          $facet: {
            items: [
              { $skip: (c.page - 1) * c.limit },
              { $limit: c.limit },
              { $project: { _ratingKey: 0, _priceKey: 0 } },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];
      const [result] = await Restaurant.aggregate(pipeline).collation(NAME_COLLATION);
      return { items: result.items.map((doc) => toEntity(doc)), total: result.total[0]?.count ?? 0 };
    },

    async findByExternalIds(ids) {
      const docs = await inSession(
        Restaurant.find({ externalPlaceId: mongoose.trusted({ $in: ids }) }).lean(),
        session
      );
      return docs.map((doc) => toEntity(doc));
    },

    async facets() {
      const group = (field) => [
        { $match: { [field]: { $ne: null } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: MAX_FACET_ROWS },
      ];
      const [result] = await Restaurant.aggregate([
        { $match: { active: true } },
        {
          $facet: {
            cities: group("city"),
            cuisines: [{ $unwind: "$cuisine" }, ...group("cuisine").slice(1)],
            categories: group("category"),
          },
        },
      ]);
      const rows = (list) => list.map((row) => ({ name: row._id, count: row.count }));
      return { cities: rows(result.cities), cuisines: rows(result.cuisines), categories: rows(result.categories) };
    },
  };
}

function createReservationsRepository(session) {
  const base = createBaseRepository(Reservation, { session });
  const entities = (docs) => docs.map((doc) => toEntity(doc));

  return {
    ...base,

    // Confirmed reservations overlapping [startAt, endAt). Touching ends do
    // not overlap, so back-to-back bookings are allowed.
    async findConflicts({ restaurantId, tableId, startAt, endAt, excludeId }) {
      const filter = {
        status: RESERVATION_STATUS.CONFIRMED,
        startAt: mongoose.trusted({ $lt: endAt }),
        endAt: mongoose.trusted({ $gt: startAt }),
      };
      if (restaurantId) {
        filter.restaurantId = restaurantId;
      }
      if (tableId) {
        filter.tableId = tableId;
      }
      if (excludeId) {
        filter._id = mongoose.trusted({ $ne: excludeId });
      }
      return entities(await inSession(Reservation.find(filter).lean(), session));
    },

    async findUpcomingOrOngoing({ tableId, now }) {
      const filter = {
        tableId,
        status: RESERVATION_STATUS.CONFIRMED,
        endAt: mongoose.trusted({ $gt: now }),
      };
      return entities(await inSession(Reservation.find(filter).lean(), session));
    },

    async existsForTable(tableId) {
      return Boolean(await inSession(Reservation.exists({ tableId }), session));
    },

    async existsForUser(userId) {
      return Boolean(await inSession(Reservation.exists({ userId }), session));
    },
  };
}

function buildRepositories(session) {
  return {
    users: createUsersRepository(session),
    sessions: createSessionsRepository(session),
    restaurants: createRestaurantsRepository(session),
    tables: createTablesRepository(session),
    reservations: createReservationsRepository(session),
  };
}

export function createMongoStore() {
  return {
    ...buildRepositories(),

    async init() {
      const models = [User, Session, Restaurant, Table, Reservation];
      await Promise.all(models.map((Model) => Model.init()));
    },

    // fn receives repositories bound to one MongoDB transaction. Mongoose
    // commits when fn resolves, aborts when it throws, and re-runs fn on
    // transient errors such as write conflicts, so fn must be safe to repeat.
    async transaction(fn) {
      let result;
      await mongoose.connection.transaction(async (session) => {
        result = await fn(buildRepositories(session));
      });
      return result;
    },
  };
}
