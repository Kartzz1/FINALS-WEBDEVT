import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDb } from "../src/config/db.js";
import { store } from "../src/repositories/index.js";
import { runStoreChecks } from "./storeChecks.js";

async function main() {
  if (env.storageMode === "mongo") {
    await connectDb(env.mongodbUri);
  }
  await store.init();
  await runStoreChecks(store);
  console.log(`All store checks passed (${env.storageMode} storage)`);
}

main()
  .catch((err) => {
    console.error("Store check failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
