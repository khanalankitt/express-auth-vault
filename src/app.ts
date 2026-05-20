import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import env from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import authRoutes from "./modules/auth/auth.route";

const app = express();

// Behind a reverse proxy in production, trust the first hop so rate-limit and
// secure cookies see the real client IP / scheme.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());

// CORS: credentials require an explicit origin allowlist. Browsers reject
// `Access-Control-Allow-Origin: *` combined with credentials, and echoing back
// any origin with credentials is a vulnerability — so wildcard disables them.
const isWildcardOrigin = env.CORS_ORIGIN === "*";
app.use(
  cors({
    origin: isWildcardOrigin
      ? "*"
      : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: !isWildcardOrigin,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({ message: "express-auth-vault running" });
});

app.use("/api/auth", authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
