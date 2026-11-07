export function rateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests, please try again later",
} = {}) {
  // Each route limiter has its own isolated memory map
  const requestCounts = new Map();

  return (req, res, next) => {
    // If rate limiting is explicitly disabled
    if (process.env.DISABLE_RATE_LIMIT === "true") {
      return next();
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "global";

    const isDev = process.env.NODE_ENV !== "production";
    const isLocalhost =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      req.hostname === "localhost";

    // In local development, provide a generous limit to prevent developers getting locked out
    const effectiveMax = isDev && isLocalhost ? Math.max(max * 50, 1000) : max;

    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, startTime: now });
      return next();
    }

    const current = requestCounts.get(ip);

    if (now - current.startTime > windowMs) {
      current.count = 1;
      current.startTime = now;
      return next();
    }

    current.count += 1;

    if (current.count > effectiveMax) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
}

export default rateLimiter;

