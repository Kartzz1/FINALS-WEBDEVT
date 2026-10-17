import { Router } from "express";
import { env } from "../config/env.js";
import { getDbStatus } from "../config/db.js";

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    storageMode: env.storageMode,
    database: env.storageMode === "mongo" ? getDbStatus() : "not-used",
  });
});

export default router;
