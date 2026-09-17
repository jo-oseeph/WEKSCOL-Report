import cookies from "../utils/cookies.js";

const { getSessionToken } = cookies;

const authenticationError = () =>
  Object.assign(new Error("Authentication required."), { statusCode: 401 });

const requireAuth = ({ sessionService, cookieName }) => {
  return (request, response, next) => {
    const user = sessionService.getUserFromToken(getSessionToken(request, cookieName));
    if (!user) return next(authenticationError());
    request.user = user;
    return next();
  };
};

export default requireAuth;