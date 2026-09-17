const errorHandler = (error, request, response, next) => {
  if (response.headersSent) return next(error);
  console.error(error);
  const statusCode = error.statusCode || 500;
  response.status(statusCode).json({
    error: statusCode === 500 ? "Unable to complete the request." : error.message,
  });
};

export default errorHandler;