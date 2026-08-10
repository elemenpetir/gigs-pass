const orderService = require("../services/orderService");

const create = async (req, res) => {
  try {
    const order = await orderService.createOrder(
      req.user.id,
      req.body.categoryId,
    );

    return res.status(201).json({
      status: "success",
      message: "Order created, awaiting payment",
      data: { order },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

module.exports = {
  create,
};
