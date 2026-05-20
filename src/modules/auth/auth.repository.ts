import prisma from "../../config/db";

class AuthRepository {
  // ---------- User ----------

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  createUser(data: { username: string; email: string; password: string }) {
    return prisma.user.create({ data });
  }

  updateUserPassword(userId: string, password: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password },
    });
  }

  // ---------- Refresh tokens ----------

  createRefreshToken(data: {
    token: string;
    userId: string;
    family: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  }

  findRefreshTokenByHash(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  // Atomic compare-and-set: revokes only if not already revoked.
  // Returns the number of rows updated (0 = someone else won the race).
  async tryRevokeActiveRefreshToken(id: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { id, isRevoked: false },
      data: { isRevoked: true },
    });
    return result.count;
  }

  revokeRefreshTokenFamily(family: string) {
    return prisma.refreshToken.updateMany({
      where: { family },
      data: { isRevoked: true },
    });
  }

  revokeAllUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ---------- Password reset tokens ----------

  createPasswordResetToken(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }) {
    return prisma.passwordResetToken.create({ data });
  }

  findPasswordResetTokenByHash(token: string) {
    return prisma.passwordResetToken.findUnique({ where: { token } });
  }

  // Atomic compare-and-set: marks used only if not already used.
  async tryConsumePasswordResetToken(id: string): Promise<number> {
    const result = await prisma.passwordResetToken.updateMany({
      where: { id, isUsed: false },
      data: { isUsed: true },
    });
    return result.count;
  }

  invalidateUserResetTokens(userId: string) {
    return prisma.passwordResetToken.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });
  }
}

export default new AuthRepository();
