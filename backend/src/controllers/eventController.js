const eventService = require("../services/eventService");

const create = async (req, res) => {
  try {
    const event = await eventService.createEvent(req.user.id, req.body);

    return res.status(201).json({
      status: "success",
      message: "Event created",
      data: { event },
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
    const event = await eventService.updateEvent(
      req.user.id,
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Event updated",
      data: { event },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const list = async (req, res) => {
  try {
    const events = await eventService.listPublishedEvents();

    return res.status(200).json({
      status: "success",
      message: "Events retrieved",
      data: { events },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

const getById = async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);

    return res.status(200).json({
      status: "success",
      message: "Event retrieved",
      data: { event },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const uploadImage = async (req, res) => {
  try {
    const event = await eventService.uploadEventImage(
      req.user.id,
      req.params.id,
      req.file,
    );

    return res.status(200).json({
      status: "success",
      message: "Event image uploaded",
      data: { event },
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
  list,
  getById,
  uploadImage,
};
