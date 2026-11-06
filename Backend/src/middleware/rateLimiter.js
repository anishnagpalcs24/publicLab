const ipRequests = new Map();

export function rateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests, please try again later",
} = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, { count: 1, startTime: now });
      return next();
    }

    const current = ipRequests.get(ip);

    if (now - current.startTime > windowMs) {
      current.count = 1;
      current.startTime = now;
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
}

export default rateLimiter;

