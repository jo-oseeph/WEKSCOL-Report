import security from "../utils/security.js";

const { createSessionToken, hashToken } = security;

const createSessionService = ({ sessionRepository, userRepository, reportPermissionRepository, sessionConfig }) => {
  async function removeExpiredSessions() {
    await sessionRepository.deleteExpired(Date.now());
  }

  return {
    async createSession(userId) {
      await removeExpiredSessions();
      const token = createSessionToken();
      await sessionRepository.create({
        tokenHash: hashToken(token),
        userId,
        expiresAt: Date.now() + sessionConfig.maxAge,
      });
      return token;
    },
    async getUserFromToken(token) {
      if (!token) return null;
      const session = await sessionRepository.findValid(hashToken(token), Date.now());
      const user = session ? await userRepository.findById(session.user_id) : null;
      if (!user || user.status !== "approved") return null;
      const permissions = await reportPermissionRepository.findForUser(user.id);
      return user
        ? {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            idNumber: user.id_number,
            avatarUrl: user.avatar_url || null,
            role: user.role || "user",
            status: user.status || "approved",
            permissions,
          }
        : null;
    },
    async getUserIdFromToken(token) {
      if (!token) return null;
      const session = await sessionRepository.findValid(hashToken(token), Date.now());
      return session?.user_id || null;
    },
    async deleteSession(token) {
      if (token) await sessionRepository.delete(hashToken(token));
    },
    async deleteUserSessions(userId) {
      await sessionRepository.deleteForUser(userId);
    },
    removeExpiredSessions,
  };
};

export default createSessionService;