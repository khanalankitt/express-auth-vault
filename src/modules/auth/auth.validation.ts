import { BadRequestError } from "../../utils/AppError";
import {
  ForgotPasswordRequestData,
  LoginRequestData,
  RegisterRequestData,
  ResetPasswordRequestData,
} from "../../types/auth.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`${field} is required`);
  }
  return value;
}

export function validateRegister(body: unknown): RegisterRequestData {
  const b = (body ?? {}) as Record<string, unknown>;
  const username = asString(b.username, "username").trim();
  const email = asString(b.email, "email").trim().toLowerCase();
  const password = asString(b.password, "password");

  if (username.length < 3 || username.length > 30) {
    throw new BadRequestError("username must be between 3 and 30 characters");
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new BadRequestError("email must be a valid email address");
  }
  if (password.length < 8) {
    throw new BadRequestError("password must be at least 8 characters");
  }

  return { username, email, password };
}

export function validateLogin(body: unknown): LoginRequestData {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = asString(b.email, "email").trim().toLowerCase();
  const password = asString(b.password, "password");
  return { email, password };
}

export function validateForgotPassword(
  body: unknown
): ForgotPasswordRequestData {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = asString(b.email, "email").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new BadRequestError("email must be a valid email address");
  }
  return { email };
}

export function validateResetPassword(
  body: unknown
): ResetPasswordRequestData {
  const b = (body ?? {}) as Record<string, unknown>;
  const token = asString(b.token, "token");
  const newPassword = asString(b.newPassword, "newPassword");
  if (newPassword.length < 8) {
    throw new BadRequestError("newPassword must be at least 8 characters");
  }
  return { token, newPassword };
}
