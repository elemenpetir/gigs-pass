const orderModel = require("../models/orderModel");
const categoryModel = require("../models/categoryModel");
const lockService = require("./lockService");
const ledgerService = require("./ledgerService");
const db = require("../config/db");

const createOrder = async (userId, categoryId) => {
  const reservation = await lockService.getReservation(userId, categoryId);

  if (!reservation) {
    const error = new Error("No active reservation for this category");
    error.statusCode = 403;
    throw error;
  }

  const existing = await orderModel.findUnpaidByBuyerAndCategory(
    userId,
    categoryId,
  );
  if (existing) {
    const error = new Error("Order already created for this reservation");
    error.statusCode = 409;
    error.data = { order: existing };
    throw error;
  }

  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  return orderModel.createOrder(userId, categoryId, category.price);
};

const listBuyerOrders = async (userId) => {
  return orderModel.findByBuyerId(userId);
};

const getOrderById = async (userId, orderId) => {
  const order = await orderModel.findByIdWithDetails(orderId);
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

  return order;
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

    return db.withTransaction(async (client) => {
      const paid = await orderModel.markPaid(orderId, client);
      if (!paid) {
        const error = new Error("Order is not awaiting payment");
        error.statusCode = 409;
        throw error;
      }
      await ledgerService.recordPaymentSplit(client, paid);
      return paid;
    });
  }

  await lockService.releaseSlot(userId, order.category_id);
  return orderModel.markExpired(orderId);
};

const overrideOrder = async ({ role }, orderId, status) => {
  if (role !== "admin") {
    const error = new Error("Forbidden: only admin can override");
    error.statusCode = 403;
    throw error;
  }

  if (status !== "held" && status !== "refunded") {
    const error = new Error("Invalid status. Only 'held' or 'refunded' allowed");
    error.statusCode = 400;
    throw error;
  }

  const order = await orderModel.findById(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (order.status !== "holding_period") {
    const error = new Error(
      "Override only valid while order is in holding_period",
    );
    error.statusCode = 409;
    throw error;
  }

  if (status === "held") {
    return orderModel.overrideStatus(orderId, "held");
  }

  return db.withTransaction(async (client) => {
    const overridden = await orderModel.overrideStatus(
      orderId,
      "refunded",
      client,
    );
    if (!overridden) {
      const error = new Error(
        "Override only valid while order is in holding_period",
      );
      error.statusCode = 409;
      throw error;
    }
    await ledgerService.recordRefund(client, order, "admin_override");
    return overridden;
  });
};

module.exports = {
  createOrder,
  listBuyerOrders,
  getOrderById,
  payOrder,
  overrideOrder,
};
