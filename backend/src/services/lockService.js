const categoryModel = require("../models/categoryModel");
const orderModel = require("../models/orderModel");
const redis = require("../config/redis");
const { grantedKey } = require("./queueService");
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

const isGranted = async (userId, categoryId) => {
  const value = await redis.get(grantedKey(categoryId, userId));
  return value !== null;
};

const reserveSlot = async (userId, categoryId) => {
  const category = await findCategory(categoryId);

  if (!(await isGranted(userId, category.id))) {
    const error = new Error("Not granted: join the queue first");
    error.statusCode = 403;
    throw error;
  }

  const key = lockKey(category.id, userId);

  const locked = await redis.set(key, "1", "EX", LOCK_TTL_SECONDS, "NX");
  if (locked !== "OK") {
    const error = new Error("Slot already reserved");
    error.statusCode = 409;
    throw error;
  }

  const remaining = await redis.decr(`stock:category:${category.id}`);
  if (remaining < 0) {
    await redis.incr(`stock:category:${category.id}`);
    await redis.del(key);
    const error = new Error("Out of stock");
    error.statusCode = 409;
    throw error;
  }

  await redis.zadd(
    lockExpiryKey(category.id),
    Date.now() + LOCK_TTL_SECONDS * 1000,
    String(userId),
  );

  return {
    locked: true,
    expiresInSeconds: LOCK_TTL_SECONDS,
    remainingStock: remaining,
  };
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
  const value = await redis.get(lockKey(category.id, userId));
  return value === null
    ? null
    : { reserved: true, expiresInSeconds: LOCK_TTL_SECONDS };
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
  reserveSlot,
  confirmSlot,
  releaseSlot,
  getReservation,
  cleanupExpiredLocks,
  lockKey,
  lockExpiryKey,
};
