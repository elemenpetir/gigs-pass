const eventModel = require("../models/eventModel");
const cloudinaryService = require("./cloudinaryService");

const isFutureDate = (date) => {
  return new Date(date).getTime() > Date.now();
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const createEvent = async (organizerId, data) => {
  const { title, description, event_date } = data;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    const error = new Error("Title is required");
    error.statusCode = 400;
    throw error;
  }

  if (!event_date || !isFutureDate(event_date)) {
    const error = new Error("Event date must be in the future");
    error.statusCode = 400;
    throw error;
  }

  return eventModel.createEvent(
    organizerId,
    title.trim(),
    description || null,
    event_date,
  );
};

const updateEvent = async (userId, eventId, data) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can update");
    error.statusCode = 403;
    throw error;
  }

  const { title, description, event_date } = data;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      const error = new Error("Title must be a non-empty string");
      error.statusCode = 400;
      throw error;
    }
  }

  if (event_date !== undefined && !isFutureDate(event_date)) {
    const error = new Error("Event date must be in the future");
    error.statusCode = 400;
    throw error;
  }

  const nextTitle = title === undefined ? event.title : title.trim();
  const nextDescription =
    description === undefined ? event.description : description || null;
  const nextEventDate = event_date === undefined ? event.event_date : event_date;

  return eventModel.updateEvent(eventId, nextTitle, nextDescription, nextEventDate);
};

const listPublishedEvents = async () => {
  return eventModel.findPublished();
};

const getEventById = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  return event;
};

const uploadEventImage = async (userId, eventId, file) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can update");
    error.statusCode = 403;
    throw error;
  }

  if (!file || !file.buffer) {
    const error = new Error("Image file is required");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(
      "Invalid image type. Allowed: jpeg, png, webp, gif",
    );
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const error = new Error("Image too large. Maximum size is 5MB");
    error.statusCode = 400;
    throw error;
  }

  const result = await cloudinaryService.uploadImage(file.buffer, {
    folder: `gigspass/events/${eventId}`,
  });

  const previousImageUrl = event.image_url;
  const updated = await eventModel.updateImage(eventId, result.secure_url);

  if (previousImageUrl && previousImageUrl !== result.secure_url) {
    const oldPublicId = previousImageUrl.split("/").pop().split(".")[0];
    await cloudinaryService.deleteImage(oldPublicId).catch(() => {});
  }

  return updated;
};

const publishEvent = async (userId, eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can publish");
    error.statusCode = 403;
    throw error;
  }

  if (event.status !== "draft") {
    const error = new Error("Only draft events can be published");
    error.statusCode = 400;
    throw error;
  }

  return eventModel.updateStatus(eventId, "published");
};

const suspendEvent = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (!isFutureDate(event.event_date)) {
    const error = new Error("Cannot suspend an event that has already taken place");
    error.statusCode = 400;
    throw error;
  }

  if (event.status !== "published") {
    const error = new Error("Only published events can be suspended");
    error.statusCode = 400;
    throw error;
  }

  return eventModel.updateStatus(eventId, "suspended");
};

module.exports = {
  createEvent,
  updateEvent,
  listPublishedEvents,
  getEventById,
  uploadEventImage,
  publishEvent,
  suspendEvent,
};
