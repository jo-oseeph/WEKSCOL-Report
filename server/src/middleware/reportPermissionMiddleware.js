const createReportPermissionMiddleware = ({ accessService }) => async (request, response, next) => {
  try {
    const hasPermission = await accessService.canAccess(request.user, request.params.reportId);
    if (!hasPermission) {
      return next(Object.assign(new Error("You do not have access to this report."), { statusCode: 403 }));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export default createReportPermissionMiddleware;