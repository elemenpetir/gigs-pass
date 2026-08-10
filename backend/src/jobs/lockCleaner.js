const categoryModel = require("../models/categoryModel");
const orderModel = require("../models/orderModel");
const redis = require("../config/redis");
const { LOCK_CLEANUP_INTERVAL_MS } = require("../config/constants");

let timer = null;

const lockKey = (categoryId, userId) =>
  `lock:category:${categoryId}:buyer:${userId}`;
const lockExpiryKey = (categoryId) => `lockexpiry:category:${categoryId}`;

const processCategory = async (categoryId) => {
  const now = Date.now();
  const expiredBuyers = await redis.zrangebyscore(
    lockExpiryKey(categoryId),
    0,
    now,
  );

  for (const userId of expiredBuyers) {
    const pipeline = redis.pipeline();
    pipeline.del(lockKey(categoryId, userId));
    pipeline.incr(`stock:category:${categoryId}`);
    pipeline.zrem(lockExpiryKey(categoryId), userId);
    await pipeline.exec();

    await orderModel.markExpiredByBuyerAndCategory(userId, categoryId);
  }

  return expiredBuyers.length;
};

const run = async () => {
  try {
    const categories = await categoryModel.findAll();
    for (const category of categories) {
      const released = await processCategory(category.id);
      if (released > 0) {
        console.log(
          `[lockCleaner] category ${category.id}: released ${released} expired lock(s)`,
        );
      }
    }
  } catch (error) {
    console.error(`[lockCleaner] error: ${error.message}`);
  }
};

const start = () => {
  if (timer) {
    return timer;
  }
  timer = setInterval(run, LOCK_CLEANUP_INTERVAL_MS);
  console.log(`[lockCleaner] started, interval ${LOCK_CLEANUP_INTERVAL_MS}ms`);
  return timer;
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { start, stop, run, processCategory };
