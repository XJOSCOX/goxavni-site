const buckets = new Map();

function keyFor(req, name) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${name}:${forwarded || req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function rateLimit({ name, windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFor(req, name);
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: message,
        code: "rate_limited",
        requestId: res.locals.requestId
      });
    }

    return next();
  };
}
