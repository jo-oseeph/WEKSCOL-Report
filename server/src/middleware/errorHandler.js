export default function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  const statusCode = error.statusCode || 500;
  response.status(statusCode).json({ error: statusCode === 500 && !error.statusCode ? "Unable to complete the request." : error.message });
}