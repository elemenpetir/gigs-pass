const categoryModel = require("../models/categoryModel");
const eventModel = require("../models/eventModel");
const orderModel = require("../models/orderModel");
const redis = require("../config/redis");
const { lockKey, lockExpiryKey, getReservation } = require("./lockService");
const {
  QUEUE_BATCH_SIZE,
  QUEUE_SEQ_KEY,
  LOCK_TTL_SECONDS,
} = require("../config/constants");

const queueKey = (eventId, categoryId) => `queue:event:${eventId}:${categoryId}`;

// ===== Category Cache (TTL 60s) =====
const categoryCache = new Map();
const CACHE_TTL_MS = 60_000;

const getCachedCategory = async (categoryId) => {
  const now = Date.now();
  const hit = categoryCache.get(categoryId);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.data;
  // fetch fresh
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }
  categoryCache.set(categoryId, { data: category, ts: now });
  return category;
};

const parseZpopResult = (flat) => {
  const dequeued = [];
  for (let i = 0; i < flat.length; i += 2) {
    dequeued.push({
      userId: flat[i],
      score: parseInt(flat[i + 1], 10),
    });
  }
  return dequeued;
};

const joinQueue = async (userId, categoryId) => {
  const category = await getCachedCategory(categoryId);
  const event = await eventModel.findById(category.event_id);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  if (new Date(event.event_date) <= new Date()) {
    const error = new Error("Event has already ended");
    error.statusCode = 410;
    throw error;
  }
  const key = queueKey(category.event_id, category.id);
  const member = String(userId);

  const existingUnpaid = await orderModel.findUnpaidByBuyerAndCategory(
    userId,
    category.id,
  );
  if (existingUnpaid) {
    const reservation = await getReservation(userId, category.id);
    if (reservation) {
      const error = new Error(
        "You still have an unpaid ticket for this tier — finish your payment",
      );
      error.statusCode = 409;
      throw error;
    }
    await orderModel.markExpiredByBuyerAndCategory(userId, category.id);
  }

  const existingPosition = await redis.zrank(key, member);
  if (existingPosition !== null) {
    return { queued: true, position: existingPosition + 1 };
  }

  const score = await redis.incr(QUEUE_SEQ_KEY);
  await redis.zadd(key, score, member);

  const position = await redis.zrank(key, member);

  return { queued: true, position: position + 1 };
};

const getQueuePosition = async (userId, categoryId) => {
  const category = await getCachedCategory(categoryId);
  const key = queueKey(category.event_id, category.id);
  const member = String(userId);

  const position = await redis.zrank(key, member);
  if (position === null) {
    return null;
  }

  return position + 1;
};

const dequeueBatch = async (categoryId, count = QUEUE_BATCH_SIZE) => {
  const category = await getCachedCategory(categoryId);
  const key = queueKey(category.event_id, category.id);

  const stockValue = await redis.get(`stock:category:${category.id}`);
  const remainingStock = stockValue === null ? null : parseInt(stockValue, 10);

  let batchSize = count;
  if (remainingStock !== null && remainingStock <= 0) {
    return [];
  }
  if (remainingStock !== null) {
    batchSize = Math.min(batchSize, remainingStock);
  }

  const popped = await redis.zpopmin(key, batchSize);
  const dequeued = parseZpopResult(popped);

  const admitted = [];
  for (const buyer of dequeued) {
    const keyLock = lockKey(category.id, buyer.userId);
    const locked = await redis.set(keyLock, "1", "EX", LOCK_TTL_SECONDS, "NX");
    if (locked !== "OK") {
      continue;
    }
    const remaining = await redis.decr(`stock:category:${category.id}`);
    if (remaining < 0) {
      await redis.incr(`stock:category:${category.id}`);
      await redis.del(keyLock);
      continue;
    }
    await redis.zadd(
      lockExpiryKey(category.id),
      Date.now() + LOCK_TTL_SECONDS * 1000,
      String(buyer.userId),
    );
    admitted.push(buyer);
  }

  return admitted;
};

module.exports = {
  joinQueue,
  getQueuePosition,
  dequeueBatch,
  queueKey,
};
