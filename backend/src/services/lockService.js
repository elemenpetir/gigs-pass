const categoryModel = require("../models/categoryModel");
const orderModel = require("../models/orderModel");
const redis = require("../config/redis");
const { LOCK_TTL_SECONDS } = require("../config/constants");

const lockKey = (categoryId, userId) =>
  `lock:category:${categoryId}:buyer:${userId}`;
const lockExpiryKey = (categoryId) => `lockexpiry:category:${categoryId}`;

const findCategory = async (categoryId) => {
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }
  return category;
};

const confirmSlot = async (userId, categoryId) => {
  const category = await findCategory(categoryId);
  const key = lockKey(category.id, userId);

  const exists = await redis.exists(key);
  if (!exists) {
    return { confirmed: false };
  }

  const pipeline = redis.pipeline();
  pipeline.del(key);
  pipeline.zrem(lockExpiryKey(category.id), String(userId));
  await pipeline.exec();

  return { confirmed: true };
};

const releaseSlot = async (userId, categoryId) => {
  const category = await findCategory(categoryId);
  const key = lockKey(category.id, userId);

  const exists = await redis.exists(key);
  if (!exists) {
    return { released: false };
  }

  const pipeline = redis.pipeline();
  pipeline.del(key);
  pipeline.incr(`stock:category:${category.id}`);
  pipeline.zrem(lockExpiryKey(category.id), String(userId));
  await pipeline.exec();

  return { released: true };
};

const getReservation = async (userId, categoryId) => {
  const category = await findCategory(categoryId);
  const key = lockKey(category.id, userId);

  const value = await redis.get(key);
  if (value === null) {
    return null;
  }

  const ttlMs = await redis.pttl(key);
  const expiresInSeconds =
    ttlMs > 0 ? Math.ceil(ttlMs / 1000) : LOCK_TTL_SECONDS;

  return { reserved: true, expiresInSeconds };
};

const cleanupExpiredLocks = async (categoryId) => {
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

module.exports = {
  confirmSlot,
  releaseSlot,
  getReservation,
  cleanupExpiredLocks,
  lockKey,
  lockExpiryKey,
};
