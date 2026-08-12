const analyticsService = require("../services/analyticsService");

const eventOverview = async (req, res) => {
  try {
    const data = await analyticsService.getEventOverview(
      req.user.id,
      req.params.id,
    );

    return res.status(200).json({
      status: "success",
      message: "Event overview retrieved",
      data,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const platformOverview = async (req, res) => {
  try {
    const data = await analyticsService.getPlatformOverview(req.user.role);

    return res.status(200).json({
      status: "success",
      message: "Platform overview retrieved",
      data,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

module.exports = {
  eventOverview,
  platformOverview,
};