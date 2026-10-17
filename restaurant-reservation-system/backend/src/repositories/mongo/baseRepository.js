import { AppError } from "../../utils/AppError.js";

const DUPLICATE_KEY_CODE = 11000;

// Repositories hand out plain objects with `id`, never Mongoose documents.
export function toEntity(doc, hidden = []) {
  if (!doc) {
    return null;
  }
  const { _id, ...rest } = doc;
  for (const field of hidden) {
    delete rest[field];
  }
  return { id: _id, ...rest };
}

export function rethrowDuplicate(err) {
  if (err?.code === DUPLICATE_KEY_CODE) {
    throw new AppError(409, "That value is already in use.");
  }
  throw err;
}

export function inSession(query, session) {
  return session ? query.session(session) : query;
}

function withoutUndefined(filter) {
  return Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value !== undefined)
  );
}

export function createBaseRepository(Model, { session, hidden = [] } = {}) {
  const entity = (doc) => toEntity(doc, hidden);

  return {
    async create(data) {
      try {
        const [doc] = await Model.create([data], { session });
        return entity(doc.toObject());
      } catch (err) {
        return rethrowDuplicate(err);
      }
    },

    async findById(id) {
      return entity(await inSession(Model.findById(id).lean(), session));
    },

    // `filter` holds simple equality conditions only, so the memory
    // implementation can behave identically.
    async list({ filter = {}, page, limit }) {
      const query = withoutUndefined(filter);
      const docs = await inSession(
        Model.find(query)
          .sort({ createdAt: -1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        session
      );
      // Sequential on purpose: one session should not run parallel operations.
      const total = await inSession(Model.countDocuments(query), session);
      return { items: docs.map(entity), total };
    },

    async update(id, changes) {
      try {
        const doc = await inSession(
          Model.findByIdAndUpdate(
            id,
            { $set: changes },
            { new: true, runValidators: true }
          ).lean(),
          session
        );
        return entity(doc);
      } catch (err) {
        return rethrowDuplicate(err);
      }
    },

    async delete(id) {
      const doc = await inSession(Model.findByIdAndDelete(id), session);
      return Boolean(doc);
    },
  };
}
