import rateLimit from "express-rate-limit";

const message = (text: string) => ({ error: { message: text } });

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("Too many login attempts. Please try again later."),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("Too many registration attempts. Please try again later."),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: message(
    "Too many password reset requests. Please try again later."
  ),
});
