import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { csrfProtection } from "./middleware/csrf.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { successFlag } from "./middleware/successFlag.js";
import apiRoutes from "./routes/index.js";

const MAX_BODY_SIZE = "10kb";

// Private data must never be kept in a shared computer's browser cache.
function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

const app = express();

// Behind a hosting proxy (Render, etc.) the real client IP comes from the
// proxy header; without this every visitor would share one rate-limit bucket.
if (env.trustProxy) {
  app.set("trust proxy", 1);
}
// Plain key=value query strings only, so "?status[$ne]=x" stays a string
// and cannot turn into an operator object.
app.set("query parser", "simple");

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    maxAge: 600,
  })
);
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use(cookieParser());

app.use("/api", noStore, successFlag, apiLimiter, csrfProtection, apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
