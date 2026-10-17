import { env } from "../config/env.js";
import { createMemoryStore } from "./memory/index.js";

// The MongoDB code is imported only when needed, so memory mode and the
// service tests never load Mongoose.
async function createStore() {
  if (env.storageMode === "mongo") {
    const { createMongoStore } = await import("./mongo/index.js");
    return createMongoStore();
  }
  return createMemoryStore();
}

// Services import this one object and never know which storage is behind it.
export const store = await createStore();
