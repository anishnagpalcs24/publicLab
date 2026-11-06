export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status && typeof err.status === "number" ? err.status : 500);
  const message = err.message || "Internal server error";

  if (process.env.NODE_ENV !== "test" && statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.requiresVerification && { requiresVerification: true, email: err.email }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export default errorHandler;
