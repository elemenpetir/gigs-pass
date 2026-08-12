const eventModel = require("../models/eventModel");
const analyticsModel = require("../models/analyticsModel");

const getEventOverview = async (userId, eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.organizer_id !== userId) {
    const error = new Error("Forbidden: only event owner can view analytics");
    error.statusCode = 403;
    throw error;
  }

  const perCategory = await analyticsModel.getEventOverview(eventId);

  const summary = perCategory.reduce(
    (acc, category) => {
      acc.revenue += category.sold_amount;
      acc.ticketsSold += category.sold_count;
      acc.heldAmount += category.held_amount;
      acc.heldCount += category.held_count;
      acc.refundedAmount += category.refunded_amount;
      acc.refundedCount += category.refunded_count;
      acc.awaitingCount += category.awaiting_count;
      acc.expiredCount += category.expired_count;
      return acc;
    },
    {
      revenue: 0,
      ticketsSold: 0,
      heldAmount: 0,
      heldCount: 0,
      refundedAmount: 0,
      refundedCount: 0,
      awaitingCount: 0,
      expiredCount: 0,
    },
  );
  summary.netRevenue = summary.revenue - summary.refundedAmount;

  const [pending, available] = await Promise.all([
    analyticsModel.getOrganizerFundBalance(
      event.organizer_id,
      "organizer_pending",
    ),
    analyticsModel.getOrganizerFundBalance(
      event.organizer_id,
      "organizer_available",
    ),
  ]);

  return {
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      event_date: event.event_date,
    },
    summary,
    perCategory,
    fundStatus: { pending, available },
  };
};

module.exports = {
  getEventOverview,
};