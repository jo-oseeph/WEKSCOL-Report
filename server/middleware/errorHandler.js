const errorHandler = (error, request, response, next) => {
  if (response.headersSent) return next(error);
  console.error(error);
  const statusCode = error.statusCode || 500;
  // Errors that already carry an explicit statusCode were deliberately
  // classified and given a safe message by the service/controller layer
  // (e.g. "Harvesting database is unavailable right now: ..."), so they are
  // safe to show as-is. Only truly unexpected 500s (no statusCode set by
  // our own code) get a generic message to avoid leaking internals.
  const isClassifiedError = typeof error.statusCode === "number";
  response.status(statusCode).json({
    error: statusCode === 500 && !isClassifiedError ? "Unable to complete the request." : error.message,
  });
};

export default errorHandler;