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

module.exports = {
  createCategory,
};
