import { Response } from "express";
import { randomUUID } from "crypto";

import env from "../../config/env";
import {
  AuthUserPayload,
  ForgotPasswordRequestData,
  LoginRequestData,
  RegisterRequestData,
  ResetPasswordRequestData,
} from "../../types/auth.types";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../utils/AppError";
import { generateRandomToken, hashToken } from "../../utils/crypto";
import { comparePassword, hashPassword } from "../../utils/hash";
import { signAccessToken } from "../../utils/jwt";
import { sendPasswordResetEmail } from "../../utils/mail";
import authRepository from "./auth.repository";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REFRESH_COOKIE_NAME = "refresh_token";

class AuthService {
  async register(data: RegisterRequestData): Promise<AuthUserPayload> {
    const existingEmail = await authRepository.findUserByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError("Email already in use");
    }

    const existingUsername = await authRepository.findUserByUsername(
      data.username
    );
    if (existingUsername) {
      throw new ConflictError("Username already taken");
    }

    const hashed = await hashPassword(data.password);
    const user = await authRepository.createUser({
      username: data.username,
      email: data.email,
      password: hashed,
    });

    return { id: user.id, email: user.email, username: user.username };
  }

  async login(
    data: LoginRequestData,
    res: Response
  ): Promise<{ accessToken: string; user: AuthUserPayload }> {
    const user = await authRepository.findUserByEmail(data.email);  
    if (!user) throw new UnauthorizedError("Invalid credentials");
    if (!user.isActive) throw new ForbiddenError("Account is disabled");

    const ok = await comparePassword(data.password, user.password);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    await this.issueRefreshToken(user.id, randomUUID(), res);

    return {
      accessToken,
      user: { id: user.id, email: user.email, username: user.username },
    };
  }

  async refresh(
    rawToken: string,
    res: Response
  ): Promise<{ accessToken: string }> {
    const hashed = hashToken(rawToken);
    const existing = await authRepository.findRefreshTokenByHash(hashed);

    if (!existing) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Reuse detection: a revoked-but-still-presented token means the family is
    // compromised. Revoke every sibling and reject.
    if (existing.isRevoked) {
      await authRepository.revokeRefreshTokenFamily(existing.family);
      this.clearRefreshCookie(res);
      throw new UnauthorizedError("Refresh token reuse detected");
    }

    if (existing.expiresAt < new Date()) {
      await authRepository.tryRevokeActiveRefreshToken(existing.id);
      this.clearRefreshCookie(res);
      throw new UnauthorizedError("Refresh token expired");
    }

    const user = await authRepository.findUserById(existing.userId);
    if (!user || !user.isActive) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedError("User not found or disabled");
    }

    // Atomic rotation: if another concurrent request beat us to revoking this
    // token, treat it as reuse and burn the whole family.
    const revoked = await authRepository.tryRevokeActiveRefreshToken(
      existing.id
    );
    if (revoked === 0) {
      await authRepository.revokeRefreshTokenFamily(existing.family);
      this.clearRefreshCookie(res);
      throw new UnauthorizedError("Refresh token reuse detected");
    }

    await this.issueRefreshToken(user.id, existing.family, res);

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    return { accessToken };
  }

  async logout(rawToken: string, res: Response): Promise<void> {
    const hashed = hashToken(rawToken);
    const existing = await authRepository.findRefreshTokenByHash(hashed);

    if (existing) {
      await authRepository.tryRevokeActiveRefreshToken(existing.id);
    }

    this.clearRefreshCookie(res);
  }

  async forgotPassword(data: ForgotPasswordRequestData): Promise<void> {
    const user = await authRepository.findUserByEmail(data.email);
    if (!user || !user.isActive) return;

    // Invalidate any outstanding reset tokens so only the newest one works.
    await authRepository.invalidateUserResetTokens(user.id);

    const rawToken = generateRandomToken();
    const hashed = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await authRepository.createPasswordResetToken({
      token: hashed,
      userId: user.id,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, rawToken);
  }

  async resetPassword(data: ResetPasswordRequestData): Promise<void> {
    const hashed = hashToken(data.token);
    const record = await authRepository.findPasswordResetTokenByHash(hashed);

    if (!record || record.isUsed || record.expiresAt < new Date()) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    // Atomic consumption: ensures a single reset token can only update the
    // password once, even if the request is replayed in parallel.
    const consumed = await authRepository.tryConsumePasswordResetToken(
      record.id
    );
    if (consumed === 0) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    const newHashed = await hashPassword(data.newPassword);
    await authRepository.updateUserPassword(record.userId, newHashed);

    // Force re-login on every device after a password reset.
    await authRepository.revokeAllUserRefreshTokens(record.userId);
  }

  async getCurrentUser(userId: string): Promise<AuthUserPayload> {
    const user = await authRepository.findUserById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found");
    }
    return { id: user.id, email: user.email, username: user.username };
  }

  // ---------- internals ----------

  private async issueRefreshToken(
    userId: string,
    family: string,
    res: Response
  ): Promise<void> {
    const rawToken = generateRandomToken();
    const hashed = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await authRepository.createRefreshToken({
      token: hashed,
      userId,
      family,
      expiresAt,
    });

    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: "/",
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  }
}

export default new AuthService();
