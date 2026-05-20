# express-auth-vault

A production-grade authentication API built with **Express 5**, **TypeScript**, **Prisma 7**, and **PostgreSQL**. It implements the patterns you'd actually want to ship: rotating refresh tokens with reuse detection, hashed-at-rest reset tokens, typed error handling with a global error handler, request validation, rate limiting, and a clean route → controller → service → repository architecture.

Built to be readable, secure by default, and easy to extend.

> **Built with the help of Claude Opus 4.7** (Anthropic). The architecture, security model, and implementation were developed collaboratively with [Claude](https://www.anthropic.com/claude) acting as a pair-programming partner.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Security Model](#security-model)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Error Handling](#error-handling)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- **Email + password authentication** with bcrypt hashing (configurable cost factor).
- **Stateless access tokens (JWT)** with short TTL (default 15 minutes).
- **Rotating refresh tokens** stored as sha256 hashes in Postgres, delivered as httpOnly cookies.
- **Refresh token reuse detection** — if a revoked token is replayed (or two concurrent rotations race), the entire token family is revoked.
- **Race-safe token consumption** — refresh rotation and reset-token consumption use atomic conditional updates.
- **Forgot / reset password** flow with single-use, time-limited, hashed reset tokens.
- **Global error handler** mapping a typed `AppError` hierarchy + JWT/Prisma errors to HTTP status codes.
- **Request validation middleware** with no extra dependencies.
- **Rate limiting** on login, register, and forgot-password endpoints.
- **Production hardening** — `helmet`, configurable CORS allowlist, JSON body cap, `trust proxy` in production.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` close the HTTP server and disconnect Prisma cleanly.
- **No user enumeration** — login and forgot-password return identical responses regardless of account existence.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js + TypeScript (strict) |
| Web framework | Express 5 |
| ORM | Prisma 7 (`prisma-client` generator) |
| Database | PostgreSQL (via `@prisma/adapter-pg`) |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Security | `helmet`, `cors`, `express-rate-limit`, httpOnly cookies |
| Mail | `nodemailer` (with a console-log fallback in dev) |
| Dev tooling | `ts-node`, `nodemon`, `tsconfig-paths` |

---

## Architecture

The auth module follows a strict four-layer separation:

```
HTTP request
   │
   ▼
[ route ]            wires middleware chains: rate-limit → validate → handler
   │
   ▼
[ controller ]       parses request shape, calls service, formats response
   │
   ▼
[ service ]          business logic, throws typed AppErrors
   │
   ▼
[ repository ]       Prisma data access only — no logic
   │
   ▼
PostgreSQL
```

Cross-cutting concerns live outside the module:

- `middlewares/` — `authenticate`, `validate`, `rateLimiter`, `errorHandler`
- `utils/` — `AppError`, `asyncHandler`, `hash`, `crypto`, `jwt`, `mail`
- `config/` — `env`, `db`, `mail` (each is a singleton)

Errors bubble up via `asyncHandler` → global `errorHandler`, so controllers don't litter the codebase with try/catch.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local, Docker, Supabase, Neon, RDS — anything that speaks Postgres)

### 1. Install

```bash
git clone <your-fork-url>
cd express-auth-vault
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_vault"
JWT_ACCESS_SECRET="<paste output of: openssl rand -base64 48>"
```

See [Environment Variables](#environment-variables) for the full list.

### 3. Create the database schema

```bash
npx prisma migrate dev --name init
```

This creates the `users`, `refresh_tokens`, and `password_reset_tokens` tables.

### 4. Run

```bash
npm run dev      # development with hot reload
npm run build    # compile to dist/
npm start        # production
```

The API listens on `http://localhost:5000` by default.

```bash
curl http://localhost:5000/health
# { "status": "ok" }
```

---

## API Reference

Base URL: `http://localhost:5000/api/auth`

All requests/responses are JSON. Refresh tokens are delivered as an httpOnly cookie named `refresh_token`.

### `POST /register`

Create a new account.

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ada","email":"ada@example.com","password":"hunter2hunter2"}'
```

**201**

```json
{ "user": { "id": "uuid", "email": "ada@example.com", "username": "ada" } }
```

**409** — email or username already taken.

### `POST /login`

Authenticate. Sets the `refresh_token` cookie and returns an access JWT.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"ada@example.com","password":"hunter2hunter2"}'
```

**200**

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "uuid", "email": "ada@example.com", "username": "ada" }
}
```

**401** — invalid credentials. **403** — account disabled.

### `POST /refresh`

Rotates the refresh token. Reads the cookie; sets a new one.

```bash
curl -X POST http://localhost:5000/api/auth/refresh -b cookies.txt -c cookies.txt
```

**200** `{ "accessToken": "..." }`
**401** — missing / invalid / expired / reused refresh token.

### `POST /forgot-password`

Requests a password reset link. Always returns 200, regardless of whether the email is on file.

```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com"}'
```

**200** `{ "message": "If this email exists, a reset link has been sent" }`

When SMTP is not configured, the reset link is logged to the server console.

### `POST /reset-password`

Consumes a reset token (from the email link). Marks the token used and revokes all refresh tokens for the user.

```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<raw-token-from-email>","newPassword":"newhunter2hunter2"}'
```

**200** `{ "message": "Password reset successful" }`
**400** — invalid or expired token.

### `POST /logout`

Revokes the current refresh token and clears the cookie.

```bash
curl -X POST http://localhost:5000/api/auth/logout -b cookies.txt -c cookies.txt
```

**200** `{ "message": "Logged out successfully" }`

### `GET /me`

Returns the authenticated user. Requires `Authorization: Bearer <accessToken>`.

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**200** `{ "user": { "id": "uuid", "email": "...", "username": "..." } }`
**401** — missing or invalid token.

---

## Project Structure

```
src/
├── app.ts                          Express app: middleware, routes, error handlers
├── server.ts                       Listen + graceful shutdown
├── config/
│   ├── env.ts                      Validated env vars (throws on missing required)
│   ├── db.ts                       PrismaClient + PrismaPg adapter
│   └── mail.ts                     Nodemailer transporter (null in dev)
├── middlewares/
│   ├── errorHandler.ts             Global error + 404 handlers
│   ├── authenticate.ts             Bearer JWT → req.user
│   ├── rateLimiter.ts              login / register / forgot-password limits
│   └── validate.ts                 Generic body validator factory
├── utils/
│   ├── AppError.ts                 AppError hierarchy (400/401/403/404/409/429/500)
│   ├── asyncHandler.ts             Promise rejection → next(err)
│   ├── hash.ts                     bcrypt wrappers
│   ├── crypto.ts                   randomBytes + sha256
│   ├── jwt.ts                      signAccessToken / verifyAccessToken
│   └── mail.ts                     sendPasswordResetEmail
├── types/
│   ├── auth.types.ts               Request DTOs + payload types
│   └── express.d.ts                Augments Express.Request with `user`
└── modules/auth/
    ├── auth.route.ts               Wires middleware chains
    ├── auth.controller.ts          Thin: parse request, call service, respond
    ├── auth.service.ts             Business logic, throws typed AppErrors
    ├── auth.repository.ts          Prisma queries only
    └── auth.validation.ts          Hand-rolled body validators
```

---

## Security Model

### Password storage
Passwords are hashed with bcrypt (default cost 12). Plaintext never touches the database or logs.

### Access tokens
Short-lived JWTs (default 15m), signed with `JWT_ACCESS_SECRET`. Stateless — the API does not store them. Sent by the client in `Authorization: Bearer <token>`.

### Refresh tokens
- Generated as 32 bytes of cryptographically random hex (`crypto.randomBytes`).
- **The raw token is only ever in transit** (httpOnly cookie). The DB stores `sha256(rawToken)`.
- Lifetime: 7 days.
- Each token has a `family` (UUID). Login starts a new family; refresh rotates within the same family.
- **Reuse detection** — if a refresh token is presented after it has been revoked, the entire family is revoked. This catches stolen-cookie scenarios.
- **Race-safe rotation** — the revoke step uses an atomic conditional update (`UPDATE ... WHERE id = ? AND isRevoked = false`). If two requests race with the same token, only one wins; the loser is treated as a replay and burns the family.

### Password reset tokens
- Same random + sha256-hashed-at-rest pattern as refresh tokens.
- 30-minute TTL, single-use (`isUsed` flag).
- Consumption is atomic — a conditional `UPDATE ... WHERE id = ? AND isUsed = false` prevents replay races from succeeding twice.
- Requesting a new reset invalidates any outstanding ones for that user.
- Successful reset revokes all refresh tokens, forcing every device to re-login.

### User enumeration
- `POST /forgot-password` returns the same 200 response whether the email exists or not.
- `POST /login` returns a generic "Invalid credentials" 401 for both wrong-email and wrong-password.

### Cookies
The `refresh_token` cookie is:
- `httpOnly` — inaccessible to JS, immune to XSS-driven token theft.
- `secure` — set automatically when `NODE_ENV=production`.
- `sameSite=lax` — sent on top-level navigations and same-site requests.
- Scoped to `path=/`.

### Rate limiting
- `POST /login` — 10 per 15 minutes per IP.
- `POST /register` — 10 per hour per IP.
- `POST /forgot-password` — 5 per hour per IP.

Behind a reverse proxy in production, `app.set("trust proxy", 1)` is enabled so the real client IP is used.

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` enables `trust proxy` + secure cookies. |
| `PORT` | no | `5000` | HTTP listen port. |
| `DATABASE_URL` | **yes** | — | Postgres connection string. |
| `JWT_ACCESS_SECRET` | **yes** | — | Generate with `openssl rand -base64 48`. |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Any [`ms`](https://github.com/vercel/ms)-compatible string. |
| `BCRYPT_COST` | no | `12` | bcrypt work factor. |
| `APP_URL` | no | `http://localhost:5000` | Used to build the password-reset link in emails. |
| `CORS_ORIGIN` | no | `http://localhost:3000` | Comma-separated origin allowlist for cookie-based auth. `*` allows any origin but disables credentials (browsers reject `*` + credentials, and reflecting any origin with credentials is unsafe). |
| `MAIL_HOST` | no | — | If unset, reset links are logged to console. |
| `MAIL_PORT` | no | — | `465` enables TLS. |
| `MAIL_USER` | no | — | SMTP username. |
| `MAIL_PASS` | no | — | SMTP password. |
| `MAIL_FROM` | no | `no-reply@auth-vault.local` | `From:` header on outbound mail. |

Missing required vars throw at startup — fail fast instead of breaking mid-request.

---

## Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | `nodemon` + `ts-node`, hot-reload on changes in `src/`. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run the compiled `dist/server.js`. |
| `npx prisma migrate dev` | Apply schema migrations (development). |
| `npx prisma migrate deploy` | Apply migrations (production). |
| `npx prisma studio` | Open the Prisma data browser. |

---

## Error Handling

Every error response has the shape:

```json
{ "error": { "message": "human-readable description" } }
```

The global error handler ([src/middlewares/errorHandler.ts](src/middlewares/errorHandler.ts)) maps:

| Source | Response |
|---|---|
| `BadRequestError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `TooManyRequestsError` | 429 |
| `TokenExpiredError` (jsonwebtoken) | 401 "Token expired" |
| `JsonWebTokenError` (jsonwebtoken) | 401 "Invalid token" |
| Prisma `P2002` (unique violation) | 409 "Resource already exists" |
| Prisma `P2025` (not found) | 404 "Resource not found" |
| Anything else | 500 (message hidden in production) |

Controllers throw typed errors; the handler does the rest:

```ts
if (existingEmail) {
  throw new ConflictError("Email already in use");
}
```

---

## Roadmap

Ideas for future iterations, not currently implemented:

- Email verification (account activation) flow
- OAuth providers (Google, GitHub) via `passport` or hand-rolled
- TOTP / WebAuthn second factor
- Per-user session management UI (list active devices, revoke individually)
- Audit log of auth events
- Structured logging (`pino`) + request IDs
- Integration tests with `vitest` + a Dockerized Postgres
- OpenAPI spec + Swagger UI

---

## License

ISC — see [package.json](package.json).
