import jwt, { type SignOptions } from "jsonwebtoken";
import env from "../config/env";
import { JwtPayload } from "../types/auth.types";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as JwtPayload;
}
