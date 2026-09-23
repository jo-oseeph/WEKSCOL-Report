import cookies from "../utils/cookies.js";

const { getSessionToken } = cookies;

const authenticationError = () =>
  Object.assign(new Error("Authentication required."), { statusCode: 401 });

const requireAuth = ({ sessionService, cookieName }) => {
  return async (request, response, next) => {
    const user = await sessionService.getUserFromToken(getSessionToken(request, cookieName));
    if (!user) return next(authenticationError());
    request.user = user;
    return next();
  };
};

export default requireAuth;