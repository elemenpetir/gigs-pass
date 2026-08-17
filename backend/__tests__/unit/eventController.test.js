const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/services/cloudinaryService", () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));

const eventController = require("../../src/controllers/eventController");
const eventModel = require("../../src/models/eventModel");
const cloudinaryService = require("../../src/services/cloudinaryService");

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
const PAST_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const createMockImageFile = (overrides = {}) => ({
  buffer: Buffer.from("fake-image-bytes"),
  mimetype: "image/jpeg",
  size: 1024,
  ...overrides,
});

describe("Event Controller", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("create", () => {
    test("should create event and return 201", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        body: {
          title: "Music Festival",
          description: "Annual festival",
          event_date: FUTURE_DATE,
          category: "music",
        },
      };
      const res = createMockReqRes();

      await eventController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event created");
      expect(res.body.data.event).toBeDefined();
      expect(res.body.data.event.title).toBe("Music Festival");
      expect(res.body.data.event.status).toBe("draft");
    });

    test("should return 400 for missing title", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        body: { event_date: FUTURE_DATE, category: "music" },
      };
      const res = createMockReqRes();

      await eventController.create(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Title is required");
    });

    test("should return 400 for past event date", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Old Event", event_date: PAST_DATE, category: "music" },
      };
      const res = createMockReqRes();

      await eventController.create(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Event date must be in the future");
    });
  });

  describe("update", () => {
    test("should update event and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Original", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        body: { title: "Updated Title" },
      };
      const res = createMockReqRes();

      await eventController.update(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event updated");
      expect(res.body.data.event.title).toBe("Updated Title");
    });

    test("should return 403 when non-owner updates", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Original", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: eventId },
        body: { title: "Hijacked" },
      };
      const res = createMockReqRes();

      await eventController.update(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("only event owner");
    });

    test("should return 404 for non-existent event", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: 9999 },
        body: { title: "Ghost" },
      };
      const res = createMockReqRes();

      await eventController.update(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });

  describe("list", () => {
    test("should return only published events with 200", async () => {
      const draftReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Draft", event_date: FUTURE_DATE, category: "music" },
      };
      await eventController.create(draftReq, createMockReqRes());

      const res = createMockReqRes();
      await eventController.list({}, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Events retrieved");
      expect(res.body.data.events).toEqual([]);
    });

    test("should return empty list when no published events", async () => {
      const res = createMockReqRes();

      await eventController.list({}, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.events).toEqual([]);
    });
  });

  describe("getById", () => {
    test("should return event by id with 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Find Me", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = { params: { id: eventId } };
      const res = createMockReqRes();

      await eventController.getById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.event.title).toBe("Find Me");
    });

    test("should return 404 for non-existent event", async () => {
      const req = { params: { id: 9999 } };
      const res = createMockReqRes();

      await eventController.getById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });

  describe("uploadImage", () => {
    beforeEach(() => {
      cloudinaryService.uploadImage.mockReset();
      cloudinaryService.deleteImage.mockReset();
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/gigspass/events/1/new-image.jpg",
      });
      cloudinaryService.deleteImage.mockResolvedValue({ result: "ok" });
    });

    test("should upload image and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Image Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
        file: createMockImageFile(),
      };
      const res = createMockReqRes();

      await eventController.uploadImage(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event image uploaded");
      expect(res.body.data.event.image_url).toContain("new-image.jpg");
    });

    test("should return 403 when non-owner uploads", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Image Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: eventId },
        file: createMockImageFile(),
      };
      const res = createMockReqRes();

      await eventController.uploadImage(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
    });

    test("should return 404 for non-existent event", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: 9999 },
        file: createMockImageFile(),
      };
      const res = createMockReqRes();

      await eventController.uploadImage(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });

  describe("publish", () => {
    test("should publish event and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Draft Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.publish(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event published");
      expect(res.body.data.event.status).toBe("published");
    });

    test("should return 403 when non-owner publishes", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Draft Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.publish(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("only event owner");
    });

    test("should return 404 for publishing non-existent event", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: 9999 },
      };
      const res = createMockReqRes();

      await eventController.publish(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });

  describe("suspend", () => {
    test("should suspend published event and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Suspend Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      const publishReq = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
      };
      await eventController.publish(publishReq, createMockReqRes());

      const req = { params: { id: eventId } };
      const res = createMockReqRes();

      await eventController.suspend(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event suspended");
      expect(res.body.data.event.status).toBe("suspended");
    });

    test("should return 400 when suspending a past event", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Past Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      await eventModel.updateEvent(eventId, "Past Event", null, PAST_DATE, "music");
      await eventController.publish(
        { user: { id: "org-1", role: "organizer" }, params: { id: eventId } },
        createMockReqRes(),
      );

      const req = { params: { id: eventId } };
      const res = createMockReqRes();

      await eventController.suspend(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("has already taken place");
    });

    test("should return 404 for suspending non-existent event", async () => {
      const req = { params: { id: 9999 } };
      const res = createMockReqRes();

      await eventController.suspend(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });

  describe("cancel", () => {
    test("should cancel published event by owner and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Cancel Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      await eventController.publish(
        { user: { id: "org-1", role: "organizer" }, params: { id: eventId } },
        createMockReqRes(),
      );

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.cancel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Event cancelled");
      expect(res.body.data.event.status).toBe("cancelled");
    });

    test("should cancel suspended event by admin and return 200", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Suspended Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      await eventController.publish(
        { user: { id: "org-1", role: "organizer" }, params: { id: eventId } },
        createMockReqRes(),
      );
      await eventController.suspend({ params: { id: eventId } }, createMockReqRes());

      const req = {
        user: { id: "admin-1", role: "admin" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.cancel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.event.status).toBe("cancelled");
    });

    test("should return 403 when non-owner organizer cancels", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Cancel Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      await eventController.publish(
        { user: { id: "org-1", role: "organizer" }, params: { id: eventId } },
        createMockReqRes(),
      );

      const req = {
        user: { id: "org-2", role: "organizer" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.cancel(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("only event owner");
    });

    test("should return 400 when cancelling a past event", async () => {
      const createReq = {
        user: { id: "org-1", role: "organizer" },
        body: { title: "Past Event", event_date: FUTURE_DATE, category: "music" },
      };
      const createRes = createMockReqRes();
      await eventController.create(createReq, createRes);
      const eventId = createRes.body.data.event.id;

      await eventModel.updateEvent(eventId, "Past Event", null, PAST_DATE, "music");
      await eventController.publish(
        { user: { id: "org-1", role: "organizer" }, params: { id: eventId } },
        createMockReqRes(),
      );

      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: eventId },
      };
      const res = createMockReqRes();

      await eventController.cancel(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("has already taken place");
    });

    test("should return 404 for cancelling non-existent event", async () => {
      const req = {
        user: { id: "org-1", role: "organizer" },
        params: { id: 9999 },
      };
      const res = createMockReqRes();

      await eventController.cancel(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Event not found");
    });
  });
});
