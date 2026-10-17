// npm run seed
//   -- --areas lipa,batangas   which places to import (default: lipa,batangas)
//   -- --dry-run               show what would change without saving anything
//   -- --demo-tables 4         ALSO create placeholder tables for restaurants that have none
//   -- --no-admin              skip creating the first administrator
//
// Restaurants come from OpenStreetMap through the Overpass API. Nothing is typed in by hand.
function parseArgs(argv) {
  const options = { areas: undefined, dryRun: false, demoTables: 0, admin: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--areas") options.areas = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--demo-tables") options.demoTables = Number(argv[++i]);
    else if (arg === "--no-admin") options.admin = false;
    else throw new Error(`Unknown option ${arg}`);
  }
  if (!Number.isInteger(options.demoTables) || options.demoTables < 0 || options.demoTables > 20) {
    throw new Error("--demo-tables must be a whole number from 0 to 20");
  }
  return options;
}

const DEMO_CAPACITIES = [2, 2, 4, 4, 6, 8];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { env } = await import("../src/config/env.js");
  if (env.storageMode !== "mongo") {
    throw new Error("Seeding needs STORAGE_MODE=mongo (and MONGODB_URI) in backend/.env. Memory storage is erased on restart.");
  }
  const { connectDb } = await import("../src/config/db.js");
  const { store } = await import("../src/repositories/index.js");
  const { seedAdmin } = await import("../src/services/seedAdmin.js");
  const { runRestaurantSync } = await import("../src/services/restaurantImportService.js");
  const { resolveAreas } = await import("../src/services/importAreas.js");

  await connectDb(env.mongodbUri);
  await store.init();
  if (options.admin) await seedAdmin();

  console.log(`Importing from ${env.restaurantApi.provider} (${env.restaurantApi.url})${options.dryRun ? " [dry run]" : ""}...`);
  const run = await runRestaurantSync({ areaKeys: options.areas, dryRun: options.dryRun });
  for (const area of run.areas) {
    console.log(
      `  ${area.city}: ${area.status}. fetched ${area.fetched}, created ${area.created}, updated ${area.updated}, ` +
        `unchanged ${area.unchanged}, duplicates ${area.duplicates}, failed ${area.failed}` +
        (area.error ? `. ${area.error}` : "")
    );
  }
  if (run.failures.length) console.log(`  ${run.failures.length} record(s) failed; see the warnings above.`);
  console.log("Restaurant data © OpenStreetMap contributors, available under the ODbL (https://www.openstreetmap.org/copyright).");

  if (options.demoTables > 0 && !options.dryRun) {
    console.log(`\nWARNING: creating ${options.demoTables} PLACEHOLDER tables per restaurant. They are not real seating data.`);
    let created = 0;
    for (const area of resolveAreas(options.areas)) {
      const { items } = await store.restaurants.search({ city: area.city, active: true, limit: 5000 });
      for (const restaurant of items) {
        if ((await store.tables.countByRestaurant(restaurant.id)) > 0) continue;
        for (let n = 0; n < options.demoTables; n += 1) {
          await store.tables.create({ restaurantId: restaurant.id, label: `T${n + 1}`, capacity: DEMO_CAPACITIES[n % DEMO_CAPACITIES.length] });
          created += 1;
        }
      }
    }
    console.log(`Created ${created} placeholder tables.`);
  }

  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  if (run.status === "failed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
