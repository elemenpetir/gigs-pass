const rateLimit = require("express-rate-limit");
const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_REGISTER_MAX,
  RATE_LIMIT_JOIN_MAX,
  RATE_LIMIT_GLOBAL_MAX,
} = require("../config/constants");

const tooManyRequestsHandler = (req, res) => {
  res.status(429).json({
    status: "error",
    message: "Too many requests - slow down and try again shortly",
  });
};

const skip = (req) => {
  if (req.headers["x-k6-test-key"] === "stress-test-secret") return true;
  return false;
};

const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_LOGIN_MAX,
  skipSuccessfulRequests: true,
  skip,
  handler: tooManyRequestsHandler,
});

const registerLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_REGISTER_MAX,
  skip,
  handler: tooManyRequestsHandler,
});

const joinLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_JOIN_MAX,
  skip,
  keyGenerator: (req) => `user:${req.user.id}`,
  handler: tooManyRequestsHandler,
});

const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_GLOBAL_MAX,
  skip: (req) => req.originalUrl.endsWith("/stream") || skip(req),
  handler: tooManyRequestsHandler,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  joinLimiter,
  globalLimiter,
};
