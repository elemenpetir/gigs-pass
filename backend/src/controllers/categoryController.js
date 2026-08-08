const categoryService = require("../services/categoryService");

const create = async (req, res) => {
  try {
    const category = await categoryService.createCategory(
      req.user.id,
      req.params.id,
      req.body,
    );

    return res.status(201).json({
      status: "success",
      message: "Ticket category created",
      data: { category },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const update = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(
      req.user.id,
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Ticket category updated",
      data: { category },
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
  update,
};
