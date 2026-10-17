import mongoose from "mongoose";

const CONNECT_TIMEOUT_MS = 5000;
const CONNECTED_STATE = 1;

// Treats $-operators inside query filters as literal values, a second
// defence against NoSQL injection on top of strict request validation.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

// Booking conflict checks rely on transactions, which MongoDB only
// supports on replica sets and sharded clusters (Atlas is a replica set).
async function assertTransactionsSupported() {
  const info = await mongoose.connection.db.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(info.setName);
  const isSharded = info.msg === "isdbgrid";
  if (!isReplicaSet && !isSharded) {
    throw new Error(
      "MongoDB must run as a replica set to support reservation transactions"
    );
  }
}

export async function connectDb(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    await assertTransactionsSupported();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error?.code === 18 || /bad auth|authentication failed/i.test(message)) {
      throw new Error(
        "MongoDB authentication failed. Verify the Atlas database username and password, and percent-encode special characters in MONGODB_URI."
      );
    }
    if (
      error?.name === "MongooseServerSelectionError" ||
      /server selection timed out|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(message)
    ) {
      throw new Error(
        "Could not reach MongoDB. Verify MONGODB_URI and allow the hosting service to connect in Atlas Network Access."
      );
    }
    throw error;
  }
}

export function getDbStatus() {
  return mongoose.connection.readyState === CONNECTED_STATE
    ? "connected"
    : "disconnected";
}
