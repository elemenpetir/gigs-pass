const categoryModel = require("../models/categoryModel");
const redis = require("../config/redis");
const {
  QUEUE_BATCH_SIZE,
  QUEUE_SEQ_KEY,
  GRANTED_TTL_SECONDS,
} = require("../config/constants");

const queueKey = (eventId, categoryId) => `queue:event:${eventId}:${categoryId}`;
const grantedKey = (categoryId, userId) =>
  `granted:category:${categoryId}:buyer:${userId}`;

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

const findCategory = async (categoryId) => {
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }
  return category;
};

const joinQueue = async (userId, categoryId) => {
  const category = await findCategory(categoryId);
  const key = queueKey(category.event_id, category.id);
  const member = String(userId);

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
  const category = await findCategory(categoryId);
  const key = queueKey(category.event_id, category.id);
  const member = String(userId);

  const position = await redis.zrank(key, member);
  if (position === null) {
    return null;
  }

  return position + 1;
};

const dequeueBatch = async (categoryId, count = QUEUE_BATCH_SIZE) => {
  const category = await findCategory(categoryId);
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

  if (dequeued.length > 0) {
    const pipeline = redis.pipeline();
    for (const buyer of dequeued) {
      pipeline.set(
        grantedKey(category.id, buyer.userId),
        "1",
        "EX",
        GRANTED_TTL_SECONDS,
      );
    }
    await pipeline.exec();
  }

  return dequeued;
};

module.exports = {
  joinQueue,
  getQueuePosition,
  dequeueBatch,
  queueKey,
  grantedKey,
};
