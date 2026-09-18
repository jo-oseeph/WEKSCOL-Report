import security from "../utils/security.js";

const { createSessionToken, hashToken } = security;

const createSessionService = ({ sessionRepository, userRepository, sessionConfig }) => {
  function removeExpiredSessions() {
    sessionRepository.deleteExpired(Date.now());
  }

  return {
    createSession(userId) {
      removeExpiredSessions();
      const token = createSessionToken();
      sessionRepository.create({
        tokenHash: hashToken(token),
        userId,
        expiresAt: Date.now() + sessionConfig.maxAge,
      });
      return token;
    },
    getUserFromToken(token) {
      if (!token) return null;
      const session = sessionRepository.findValid(hashToken(token), Date.now());
      const user = session ? userRepository.findById(session.user_id) : null;
      return user
        ? {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            idNumber: user.id_number,
            avatarUrl: user.avatar_url || null,
          }
        : null;
    },
    getUserIdFromToken(token) {
      if (!token) return null;
      const session = sessionRepository.findValid(hashToken(token), Date.now());
      return session?.user_id || null;
    },
    deleteSession(token) {
      if (token) sessionRepository.delete(hashToken(token));
    },
    removeExpiredSessions,
  };
};

export default createSessionService;