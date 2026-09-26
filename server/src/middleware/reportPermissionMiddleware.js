const requireReportPermission = (request, response, next) => {
  const reportId = request.params.reportId;
  const isAdmin = request.user?.role === "admin";
  const hasPermission = request.user?.permissions?.includes(reportId);

  if (!isAdmin && !hasPermission) {
    return next(Object.assign(new Error("You do not have access to this report."), { statusCode: 403 }));
  }

  return next();
};

export default requireReportPermission;