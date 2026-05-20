import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: optionalInt("PORT", 5000),

  DATABASE_URL: required("DATABASE_URL"),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_ACCESS_EXPIRES_IN: optional("JWT_ACCESS_EXPIRES_IN", "15m"),

  BCRYPT_COST: optionalInt("BCRYPT_COST", 12),

  APP_URL: optional("APP_URL", "http://localhost:5000"),
  CORS_ORIGIN: optional("CORS_ORIGIN", "*"),

  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT ? optionalInt("MAIL_PORT", 587) : undefined,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASS: process.env.MAIL_PASS,
  MAIL_FROM: optional("MAIL_FROM", "no-reply@auth-vault.local"),
} as const;

export default env;
