jest.mock("../../src/services/analyticsService", () => ({
  getEventOverview: jest.fn(),
  getPlatformOverview: jest.fn(),
}));

const analyticsController = require("../../src/controllers/analyticsController");
const analyticsService = require("../../src/services/analyticsService");

const createMockReqRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe("Analytics Controller — eventOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns success envelope with overview data", async () => {
    const data = {
      event: { id: "ev-1", title: "Festival", status: "published" },
      summary: { revenue: 750000, netRevenue: 750000 },
      perCategory: [],
      fundStatus: { pending: 0, available: 0 },
    };
    analyticsService.getEventOverview.mockResolvedValue(data);

    const req = {
      user: { id: "org-1", role: "organizer" },
      params: { id: "ev-1" },
    };
    const res = createMockReqRes();

    await analyticsController.eventOverview(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Event overview retrieved");
    expect(res.body.data).toEqual(data);
    expect(analyticsService.getEventOverview).toHaveBeenCalledWith(
      "org-1",
      "ev-1",
    );
  });

  test("returns 403 envelope when user is not the owner", async () => {
    const error = new Error("Forbidden: only event owner can view analytics");
    error.statusCode = 403;
    analyticsService.getEventOverview.mockRejectedValue(error);

    const req = {
      user: { id: "org-2", role: "organizer" },
      params: { id: "ev-1" },
    };
    const res = createMockReqRes();

    await analyticsController.eventOverview(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("only event owner");
    expect(res.body.data).toBeUndefined();
  });

  test("masks unknown errors as 500 internal server error", async () => {
    analyticsService.getEventOverview.mockRejectedValue(new Error("boom"));

    const req = {
      user: { id: "org-1", role: "organizer" },
      params: { id: "ev-1" },
    };
    const res = createMockReqRes();

    await analyticsController.eventOverview(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Internal server error");
  });
});

describe("Analytics Controller — platformOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns success envelope with platform overview data", async () => {
    const data = {
      revenue: { gross: 1000000, count: 8 },
      refunded: {
        amount: 100000,
        count: 1,
        eventCancelled: 1,
        adminOverride: 0,
      },
      byStatus: [],
      events: { total: 2, published: 1, cancelled: 0 },
      buyers: 6,
      platformRevenueBalance: 100000,
    };
    analyticsService.getPlatformOverview.mockResolvedValue(data);

    const req = { user: { id: "adm-1", role: "admin" } };
    const res = createMockReqRes();

    await analyticsController.platformOverview(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Platform overview retrieved");
    expect(res.body.data).toEqual(data);
    expect(analyticsService.getPlatformOverview).toHaveBeenCalledWith("admin");
  });

  test("returns 403 envelope for non-admin", async () => {
    const error = new Error(
      "Forbidden: only admin can view platform analytics",
    );
    error.statusCode = 403;
    analyticsService.getPlatformOverview.mockRejectedValue(error);

    const req = { user: { id: "org-1", role: "organizer" } };
    const res = createMockReqRes();

    await analyticsController.platformOverview(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("only admin");
  });
});