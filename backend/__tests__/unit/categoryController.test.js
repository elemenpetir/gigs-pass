const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/config/redis", () => ({
  set: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
}));

const categoryController = require("../../src/controllers/categoryController");
const eventController = require("../../src/controllers/eventController");

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

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

describe("Category Controller", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("create", () => {
    test("should create category and return 201", async () => {
      const createEventReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Festival", event_date: FUTURE_DATE },
      };
      const createEventRes = createMockReqRes();
      await eventController.create(createEventReq, createEventRes);
      const eventId = createEventRes.body.data.event.id;

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        body: { name: "Early Bird", price: 150000, quota: 50 },
      };
      const res = createMockReqRes();

      await categoryController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Ticket category created");
      expect(res.body.data.category).toBeDefined();
      expect(res.body.data.category.name).toBe("Early Bird");
    });

    test("should return 403 when non-owner creates category", async () => {
      const createEventReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Festival", event_date: FUTURE_DATE },
      };
      const createEventRes = createMockReqRes();
      await eventController.create(createEventReq, createEventRes);
      const eventId = createEventRes.body.data.event.id;

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: eventId },
        body: { name: "Early Bird", price: 150000, quota: 50 },
      };
      const res = createMockReqRes();

      await categoryController.create(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("only event owner");
    });
  });
});
