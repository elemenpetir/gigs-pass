const orderService = require("../services/orderService");

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
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

module.exports = {
  overrideOrder,
};
