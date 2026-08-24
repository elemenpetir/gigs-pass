const QUEUE_BATCH_SIZE = parseInt(process.env.QUEUE_BATCH_SIZE, 10) || 50;
const QUEUE_DEQUEUE_INTERVAL_MS =
  parseInt(process.env.QUEUE_DEQUEUE_INTERVAL_MS, 10) || 5000;
const QUEUE_STREAM_POLL_INTERVAL_MS =
  parseInt(process.env.QUEUE_STREAM_POLL_INTERVAL_MS, 10) || 2000;
const QUEUE_STREAM_HEARTBEAT_MS =
  parseInt(process.env.QUEUE_STREAM_HEARTBEAT_MS, 10) || 15000;
const QUEUE_SEQ_KEY = "queue:seq";
const LOCK_TTL_SECONDS = parseInt(process.env.LOCK_TTL_SECONDS, 10) || 300;
const PLATFORM_COMMISSION_PERCENT =
  parseInt(process.env.PLATFORM_COMMISSION_PERCENT, 10) || 10;
const HOLDING_PERIOD_DAYS = parseInt(process.env.HOLDING_PERIOD_DAYS, 10) || 7;
const ORDER_LIFECYCLE_INTERVAL_MS =
  parseInt(process.env.ORDER_LIFECYCLE_INTERVAL_MS, 10) ||
  24 * 60 * 60 * 1000;
const EVENT_CATEGORIES = [
  "music",
  "festival",
  "concert",
  "comedy",
  "art",
  "culture",
];

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isTestEnv = process.env.NODE_ENV === "test";
const testUnlimited = Number.MAX_SAFE_INTEGER;

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  60000,
);
const RATE_LIMIT_LOGIN_MAX = parsePositiveInt(
  process.env.RATE_LIMIT_LOGIN_MAX,
  isTestEnv ? testUnlimited : 10,
);
const RATE_LIMIT_REGISTER_MAX = parsePositiveInt(
  process.env.RATE_LIMIT_REGISTER_MAX,
  isTestEnv ? testUnlimited : 10,
);
const RATE_LIMIT_JOIN_MAX = parsePositiveInt(
  process.env.RATE_LIMIT_JOIN_MAX,
  isTestEnv ? testUnlimited : 30,
);
const RATE_LIMIT_GLOBAL_MAX = parsePositiveInt(
  process.env.RATE_LIMIT_GLOBAL_MAX,
  isTestEnv ? testUnlimited : 600,
);

module.exports = {
  QUEUE_BATCH_SIZE,
  QUEUE_DEQUEUE_INTERVAL_MS,
  QUEUE_STREAM_POLL_INTERVAL_MS,
  QUEUE_STREAM_HEARTBEAT_MS,
  QUEUE_SEQ_KEY,
  LOCK_TTL_SECONDS,
  PLATFORM_COMMISSION_PERCENT,
  HOLDING_PERIOD_DAYS,
  ORDER_LIFECYCLE_INTERVAL_MS,
  EVENT_CATEGORIES,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_REGISTER_MAX,
  RATE_LIMIT_JOIN_MAX,
  RATE_LIMIT_GLOBAL_MAX,
};
