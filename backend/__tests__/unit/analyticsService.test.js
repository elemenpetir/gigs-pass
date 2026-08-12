jest.mock("../../src/models/analyticsModel");
jest.mock("../../src/models/eventModel");

const analyticsService = require("../../src/services/analyticsService");
const analyticsModel = require("../../src/models/analyticsModel");
const eventModel = require("../../src/models/eventModel");

const event = {
  id: "ev-1",
  organizer_id: "org-1",
  title: "Festival",
  status: "published",
  event_date: "2026-09-01T00:00:00.000Z",
};

describe("Analytics Service — getEventOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns event info, summary, perCategory and fundStatus for owner", async () => {
    eventModel.findById.mockResolvedValue(event);
    analyticsModel.getEventOverview.mockResolvedValue([
      {
        category_id: "c-1",
        name: "General Admission",
        price: 150000,
        quota: 10,
        sold_count: 3,
        sold_amount: 450000,
        held_count: 1,
        held_amount: 150000,
        refunded_count: 0,
        refunded_amount: 0,
        awaiting_count: 0,
        expired_count: 0,
      },
      {
        category_id: "c-2",
        name: "VIP",
        price: 300000,
        quota: 5,
        sold_count: 1,
        sold_amount: 300000,
        held_count: 0,
        held_amount: 0,
        refunded_count: 1,
        refunded_amount: 300000,
        awaiting_count: 1,
        expired_count: 2,
      },
    ]);
    analyticsModel.getOrganizerFundBalance
      .mockResolvedValueOnce(120000)
      .mockResolvedValueOnce(450000);

    const result = await analyticsService.getEventOverview("org-1", "ev-1");

    expect(eventModel.findById).toHaveBeenCalledWith("ev-1");
    expect(result.event).toEqual({
      id: "ev-1",
      title: "Festival",
      status: "published",
      event_date: "2026-09-01T00:00:00.000Z",
    });
    expect(result.summary).toEqual({
      revenue: 750000,
      ticketsSold: 4,
      heldAmount: 150000,
      heldCount: 1,
      refundedAmount: 300000,
      refundedCount: 1,
      awaitingCount: 1,
      expiredCount: 2,
      netRevenue: 450000,
    });
    expect(result.perCategory).toHaveLength(2);
    expect(result.fundStatus).toEqual({
      pending: 120000,
      available: 450000,
    });
    expect(analyticsModel.getOrganizerFundBalance).toHaveBeenCalledWith(
      "org-1",
      "organizer_pending",
    );
    expect(analyticsModel.getOrganizerFundBalance).toHaveBeenCalledWith(
      "org-1",
      "organizer_available",
    );
  });

  test("throws 403 when user is not the event owner", async () => {
    eventModel.findById.mockResolvedValue(event);

    await expect(
      analyticsService.getEventOverview("org-2", "ev-1"),
    ).rejects.toThrow("only event owner");
  });

  test("throws 404 when event does not exist", async () => {
    eventModel.findById.mockResolvedValue(null);

    await expect(
      analyticsService.getEventOverview("org-1", "ev-x"),
    ).rejects.toThrow("Event not found");
  });
});

describe("Analytics Service — getPlatformOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns platform overview for admin", async () => {
    analyticsModel.getPlatformOverview.mockResolvedValue({
      revenue: { gross: 1000000, count: 8 },
      refunded: {
        amount: 100000,
        count: 1,
        eventCancelled: 1,
        adminOverride: 0,
      },
      byStatus: [{ status: "pending", count: 8 }],
      events: { total: 2, published: 1, cancelled: 0 },
      buyers: 6,
      platformRevenueBalance: 100000,
    });

    const result = await analyticsService.getPlatformOverview("admin");

    expect(analyticsModel.getPlatformOverview).toHaveBeenCalled();
    expect(result.revenue).toEqual({ gross: 1000000, count: 8 });
    expect(result.refunded.eventCancelled).toBe(1);
    expect(result.buyers).toBe(6);
  });

  test("throws 403 for non-admin role", async () => {
    await expect(
      analyticsService.getPlatformOverview("organizer"),
    ).rejects.toThrow("only admin");

    expect(analyticsModel.getPlatformOverview).not.toHaveBeenCalled();
  });
});