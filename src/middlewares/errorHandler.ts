import {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import env from "../config/env";
import { AppError, NotFoundError } from "../utils/AppError";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof TokenExpiredError) {
    res.status(401).json({ error: { message: "Token expired" } });
    return;
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json({ error: { message: "Invalid token" } });
    return;
  }

  // Prisma known errors — matched by code to avoid an import-time dependency on
  // the generated client just for the error class.
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2002") {
    res.status(409).json({ error: { message: "Resource already exists" } });
    return;
  }
  if (code === "P2025") {
    res.status(404).json({ error: { message: "Resource not found" } });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({
    error: {
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : (err as Error)?.message ?? "Unknown error",
    },
  });
};
