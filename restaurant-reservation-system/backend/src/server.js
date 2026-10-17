// Modules are imported inside start() so a settings problem (a missing .env
// value, an uninstalled package) prints one clear message, not a long stack trace.
async function start() {
  const { env } = await import("./config/env.js");
  const { default: app } = await import("./app.js");
  const { store } = await import("./repositories/index.js");
  const { seedAdmin } = await import("./services/seedAdmin.js");

  if (env.storageMode === "mongo") {
    const { connectDb } = await import("./config/db.js");
    await connectDb(env.mongodbUri);
    console.log("MongoDB connected");
  }
  await store.init();
  await seedAdmin();

  const server = app.listen(env.port, () => {
    console.log(
      `Restaurant Reservation System API listening on port ${env.port} (${env.storageMode} storage)`
    );
  });
  server.on("error", (err) => {
    const reason =
      err.code === "EADDRINUSE"
        ? `Port ${env.port} is already in use. Close the other program or change PORT in backend/.env.`
        : err.message;
    console.error(`\nCould not start the server: ${reason}`);
    process.exit(1);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});

start().catch((err) => {
  console.error(`\nStartup problem: ${err.message}`);
  if (err.code === "ERR_MODULE_NOT_FOUND") {
    console.error("A package is missing. Run `npm install` inside the backend folder, then start again.");
  }
  process.exit(1);
});
