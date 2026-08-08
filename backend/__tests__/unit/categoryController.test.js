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

  describe("update", () => {
    test("should update category and return 200", async () => {
      const createEventReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Festival", event_date: FUTURE_DATE },
      };
      const createEventRes = createMockReqRes();
      await eventController.create(createEventReq, createEventRes);
      const eventId = createEventRes.body.data.event.id;

      const createCatReq = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        body: { name: "Early Bird", price: 150000, quota: 50 },
      };
      const createCatRes = createMockReqRes();
      await categoryController.create(createCatReq, createCatRes);
      const categoryId = createCatRes.body.data.category.id;

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: categoryId },
        body: { name: "Regular", price: 200000, quota: 100 },
      };
      const res = createMockReqRes();

      await categoryController.update(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Ticket category updated");
      expect(res.body.data.category.name).toBe("Regular");
    });

    test("should return 403 when non-owner updates category", async () => {
      const createEventReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Festival", event_date: FUTURE_DATE },
      };
      const createEventRes = createMockReqRes();
      await eventController.create(createEventReq, createEventRes);
      const eventId = createEventRes.body.data.event.id;

      const createCatReq = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        body: { name: "Early Bird", price: 150000, quota: 50 },
      };
      const createCatRes = createMockReqRes();
      await categoryController.create(createCatReq, createCatRes);
      const categoryId = createCatRes.body.data.category.id;

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: categoryId },
        body: { name: "Hijacked" },
      };
      const res = createMockReqRes();

      await categoryController.update(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("only event owner");
    });

    test("should return 404 for updating non-existent category", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: 9999 },
        body: { name: "Ghost" },
      };
      const res = createMockReqRes();

      await categoryController.update(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Category not found");
    });
  });

  describe("listByEvent", () => {
    test("should return categories for event with 200", async () => {
      const createEventReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Festival", event_date: FUTURE_DATE },
      };
      const createEventRes = createMockReqRes();
      await eventController.create(createEventReq, createEventRes);
      const eventId = createEventRes.body.data.event.id;

      const createCatReq = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        body: { name: "Early Bird", price: 150000, quota: 50 },
      };
      await categoryController.create(createCatReq, createMockReqRes());

      const req = { params: { id: eventId } };
      const res = createMockReqRes();

      await categoryController.listByEvent(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Ticket categories retrieved");
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].name).toBe("Early Bird");
    });

    test("should return 404 for non-existent event", async () => {
      const req = { params: { id: 9999 } };
      const res = createMockReqRes();

      await categoryController.listByEvent(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });
});
