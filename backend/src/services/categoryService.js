const categoryModel = require("../models/categoryModel");
const eventModel = require("../models/eventModel");
const orderModel = require("../models/orderModel");
const redis = require("../config/redis");

const stockKey = (categoryId) => `stock:category:${categoryId}`;

const createCategory = async (userId, eventId, data) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can manage ticket categories");
    error.statusCode = 403;
    throw error;
  }

  const { name, price, quota } = data;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    const error = new Error("Category name is required");
    error.statusCode = 400;
    throw error;
  }

  if (price === undefined || price === null || !Number.isInteger(price) || price < 0) {
    const error = new Error("Price must be a non-negative integer");
    error.statusCode = 400;
    throw error;
  }

  if (quota === undefined || quota === null || !Number.isInteger(quota) || quota <= 0) {
    const error = new Error("Quota must be a positive integer");
    error.statusCode = 400;
    throw error;
  }

  const category = await categoryModel.createCategory(
    eventId,
    name.trim(),
    price,
    quota,
  );

  await redis.set(stockKey(category.id), quota);

  return category;
};

const updateCategory = async (userId, categoryId, data) => {
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  const event = await eventModel.findById(category.event_id);
  if (!event || event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can manage ticket categories");
    error.statusCode = 403;
    throw error;
  }

  const { name, price, quota } = data;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      const error = new Error("Category name must be a non-empty string");
      error.statusCode = 400;
      throw error;
    }
  }

  if (price !== undefined && (!Number.isInteger(price) || price < 0)) {
    const error = new Error("Price must be a non-negative integer");
    error.statusCode = 400;
    throw error;
  }

  if (quota !== undefined && (!Number.isInteger(quota) || quota <= 0)) {
    const error = new Error("Quota must be a positive integer");
    error.statusCode = 400;
    throw error;
  }

  const nextName = name === undefined ? category.name : name.trim();
  const nextPrice = price === undefined ? category.price : price;
  const nextQuota = quota === undefined ? category.quota : quota;

  const updated = await categoryModel.updateCategory(
    categoryId,
    nextName,
    nextPrice,
    nextQuota,
  );

  if (quota !== undefined) {
    await redis.set(stockKey(categoryId), nextQuota);
  }

  return updated;
};

const computeSoldMap = async (categories) => {
  const soldRows = await orderModel.countSoldByCategoryIds(
    categories.map((c) => c.id),
  );
  return soldRows.reduce((acc, row) => {
    acc[String(row.category_id)] = row.sold;
    return acc;
  }, {});
};

const listCategoriesByEvent = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const categories = await categoryModel.findByEventId(eventId);
  if (categories.length === 0) {
    return [];
  }

  const resolved = categories.map((cat) => cat);
  let redisStocks;
  try {
    redisStocks = await redis.mget(...categories.map((c) => stockKey(c.id)));
  } catch (err) {
    redisStocks = null;
  }

  if (redisStocks === null) {
    const soldMap = await computeSoldMap(categories);
    return categories.map((cat) => ({
      ...cat,
      stock: Math.max(0, cat.quota - (soldMap[String(cat.id)] || 0)),
    }));
  }

  const missing = [];
  redisStocks.forEach((stock, idx) => {
    if (stock !== null) {
      resolved[idx] = { ...categories[idx], stock: parseInt(stock, 10) };
    } else {
      missing.push(idx);
    }
  });

  if (missing.length === 0) {
    return resolved;
  }

  const soldMap = await computeSoldMap(categories);
  const pipeline = redis.pipeline();
  for (const idx of missing) {
    const cat = categories[idx];
    const stock = Math.max(0, cat.quota - (soldMap[String(cat.id)] || 0));
    resolved[idx] = { ...cat, stock };
    pipeline.set(stockKey(cat.id), stock);
  }
  await pipeline.exec();

  return resolved;
};

module.exports = {
  createCategory,
  updateCategory,
  listCategoriesByEvent,
};
