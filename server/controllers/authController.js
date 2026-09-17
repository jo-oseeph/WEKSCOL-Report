import cookies from "../utils/cookies.js";

const { clearSessionCookie, getSessionToken, setSessionCookie } = cookies;

const currentUserId = (request, sessionService, cookieName) => {
  const userId = sessionService.getUserIdFromToken(
    getSessionToken(request, cookieName),
  );
  if (!userId) {
    throw Object.assign(new Error("You must be logged in."), { statusCode: 401 });
  }
  return userId;
};

const createAuthController = ({ authService, sessionService, sessionConfig }) => {
  const cookieName = sessionConfig.cookieName;

  return {
    getCurrentUser(request, response, next) {
      try {
        const token = getSessionToken(request, cookieName);
        response.json({ user: sessionService.getUserFromToken(token) });
      } catch (error) {
        next(error);
      }
    },
    async register(request, response, next) {
      try {
        const user = await authService.register(request.body);
        response.status(201).json({ user });
      } catch (error) {
        next(error);
      }
    },
    async login(request, response, next) {
      try {
        const result = await authService.login(request.body);
        setSessionCookie(response, cookieName, result.token, sessionConfig);
        response.json({ user: result.user });
      } catch (error) {
        next(error);
      }
    },
    logout(request, response, next) {
      try {
        const token = getSessionToken(request, cookieName);
        sessionService.deleteSession(token);
        clearSessionCookie(response, cookieName, sessionConfig);
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
    async updateProfile(request, response, next) {
      try {
        const user = await authService.updateProfile(
          currentUserId(request, sessionService, cookieName),
          request.body,
        );
        response.json({ user });
      } catch (error) {
        next(error);
      }
    },
    async changePassword(request, response, next) {
      try {
        await authService.changePassword(
          currentUserId(request, sessionService, cookieName),
          request.body,
        );
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  };
};

export default createAuthController;