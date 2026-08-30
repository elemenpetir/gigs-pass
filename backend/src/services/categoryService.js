const categoryModel = require("../models/categoryModel");
const eventModel = require("../models/eventModel");
const redis = require("../config/redis");

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

  await redis.set(`stock:category:${category.id}`, quota);

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
    await redis.set(`stock:category:${categoryId}`, nextQuota);
  }

  return updated;
};

const listCategoriesByEvent = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const categories = await categoryModel.findByEventId(eventId);

  // Fetch Redis stock for each category
  const categoriesWithStock = await Promise.all(
    categories.map(async (cat) => {
      const stock = await redis.get(`stock:category:${cat.id}`);
      return {
        ...cat,
        stock: stock !== null ? parseInt(stock, 10) : cat.quota,
      };
    })
  );

  return categoriesWithStock;
};

module.exports = {
  createCategory,
  updateCategory,
  listCategoriesByEvent,
};
