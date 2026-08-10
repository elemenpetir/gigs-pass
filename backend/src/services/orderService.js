const orderModel = require("../models/orderModel");
const lockService = require("./lockService");

const createOrder = async (userId, categoryId) => {
  const reservation = await lockService.getReservation(userId, categoryId);

  if (!reservation) {
    const error = new Error("No active reservation for this category");
    error.statusCode = 403;
    throw error;
  }

  const existing = await orderModel.findActiveByBuyerAndCategory(
    userId,
    categoryId,
  );
  if (existing) {
    const error = new Error("Order already created for this reservation");
    error.statusCode = 409;
    throw error;
  }

  return orderModel.createOrder(userId, categoryId);
};

module.exports = {
  createOrder,
};
