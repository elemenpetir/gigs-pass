const eventModel = require("../models/eventModel");

const isFutureDate = (date) => {
  return new Date(date).getTime() > Date.now();
};

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

module.exports = {
  createEvent,
  updateEvent,
  listPublishedEvents,
  getEventById,
};
