const eventModel = require("../models/eventModel");
const orderModel = require("../models/orderModel");
const orderService = require("../services/orderService");

const listEvents = async (req, res) => {
  try {
    const events = await eventModel.findAll();

    return res.status(200).json({
      status: "success",
      message: "Events retrieved",
      data: { events },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const listOrders = async (req, res) => {
  try {
    const orders = await orderModel.findAll();

    return res.status(200).json({
      status: "success",
      message: "Orders retrieved",
      data: { orders },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const overrideOrder = async (req, res) => {
  try {
    const order = await orderService.overrideOrder(
      req.user,
      req.params.id,
      req.body.status,
    );

    return res.status(200).json({
      status: "success",
      message: `Order overridden to ${order.status}`,
      data: { order },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "test") {
      console.error("[E2E] overrideOrder failed:", {
        orderId: req.params.id,
        status: req.body && req.body.status,
        role: req.user && req.user.role,
        error: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
      });
    }
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

module.exports = {
  listEvents,
  listOrders,
  overrideOrder,
};
