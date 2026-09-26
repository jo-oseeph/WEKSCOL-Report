const requireAdmin = (request, response, next) => {
  if (request.user?.role !== "admin") {
    return next(Object.assign(new Error("Administrator access required."), { statusCode: 403 }));
  }
  return next();
};

export default requireAdmin;