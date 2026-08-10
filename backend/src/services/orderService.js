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

const payOrder = async (userId, orderId, success) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (order.buyer_id !== userId) {
    const error = new Error("Forbidden: not your order");
    error.statusCode = 403;
    throw error;
  }

  if (order.status !== "awaiting_payment") {
    const error = new Error("Order is not awaiting payment");
    error.statusCode = 409;
    throw error;
  }

  if (success) {
    const confirmed = await lockService.confirmSlot(userId, order.category_id);
    if (!confirmed.confirmed) {
      const error = new Error("Reservation expired");
      error.statusCode = 409;
      throw error;
    }
    return orderModel.markPaid(orderId);
  }

  await lockService.releaseSlot(userId, order.category_id);
  return orderModel.markExpired(orderId);
};

module.exports = {
  createOrder,
  payOrder,
};
