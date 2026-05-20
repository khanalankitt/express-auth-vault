import { NextFunction, Request, Response } from "express";

import { UnauthorizedError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication required"));
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(new UnauthorizedError("Authentication required"));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
