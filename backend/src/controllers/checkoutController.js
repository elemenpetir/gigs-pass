const lockService = require("../services/lockService");

const lock = async (req, res) => {
  try {
    const result = await lockService.getReservation(
      req.user.id,
      req.params.categoryId,
    );

    if (!result) {
      const error = new Error("No active reservation - join the queue first");
      error.statusCode = 403;
      throw error;
    }

    return res.status(200).json({
      status: "success",
      message: "Slot reserved",
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

module.exports = {
  lock,
};
