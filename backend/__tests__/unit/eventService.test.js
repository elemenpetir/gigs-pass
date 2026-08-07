const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/services/cloudinaryService", () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));

const eventService = require("../../src/services/eventService");
const eventModel = require("../../src/models/eventModel");
const cloudinaryService = require("../../src/services/cloudinaryService");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const createMockImageFile = (overrides = {}) => ({
  buffer: Buffer.from("fake-image-bytes"),
  mimetype: "image/jpeg",
  size: 1024,
  ...overrides,
});

describe("Event Service", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("createEvent", () => {
    test("should create event with draft status", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Music Festival",
        description: "Annual festival",
        event_date: FUTURE_DATE,
      });

      expect(event).toBeDefined();
      expect(event.title).toBe("Music Festival");
      expect(event.status).toBe("draft");
      expect(event.organizer_id).toBe("org-1");
    });

    test("should reject missing title", async () => {
      await expect(
        eventService.createEvent("org-1", {
          event_date: FUTURE_DATE,
        }),
      ).rejects.toThrow("Title is required");
    });

    test("should reject empty title", async () => {
      await expect(
        eventService.createEvent("org-1", {
          title: "   ",
          event_date: FUTURE_DATE,
        }),
      ).rejects.toThrow("Title is required");
    });

    test("should reject missing event date", async () => {
      await expect(
        eventService.createEvent("org-1", {
          title: "Music Festival",
        }),
      ).rejects.toThrow("Event date must be in the future");
    });

    test("should reject past event date", async () => {
      await expect(
        eventService.createEvent("org-1", {
          title: "Music Festival",
          event_date: PAST_DATE,
        }),
      ).rejects.toThrow("Event date must be in the future");
    });

    test("should allow event without description", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      expect(event.description).toBeNull();
    });
  });

  describe("updateEvent", () => {
    test("should update event when owner", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Original",
        event_date: FUTURE_DATE,
      });

      const updated = await eventService.updateEvent("org-1", created.id, {
        title: "Updated Title",
      });

      expect(updated.title).toBe("Updated Title");
    });

    test("should reject update by non-owner", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Original",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.updateEvent("org-2", created.id, {
          title: "Hijacked",
        }),
      ).rejects.toThrow("only event owner");
    });

    test("should reject update of non-existent event", async () => {
      await expect(
        eventService.updateEvent("org-1", 9999, {
          title: "Ghost",
        }),
      ).rejects.toThrow("Event not found");
    });

    test("should reject past event date on update", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Original",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.updateEvent("org-1", created.id, {
          event_date: PAST_DATE,
        }),
      ).rejects.toThrow("Event date must be in the future");
    });
  });

  describe("listPublishedEvents", () => {
    test("should return only published events", async () => {
      await eventService.createEvent("org-1", {
        title: "Draft Event",
        event_date: FUTURE_DATE,
      });

      const published = await eventService.createEvent("org-2", {
        title: "Published Event",
        event_date: FUTURE_DATE,
      });
      await eventModel.updateStatus(published.id, "published");

      const events = await eventService.listPublishedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Published Event");
    });

    test("should return empty array when no published events", async () => {
      const events = await eventService.listPublishedEvents();

      expect(events).toEqual([]);
    });
  });

  describe("getEventById", () => {
    test("should return event by id", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Find Me",
        event_date: FUTURE_DATE,
      });

      const event = await eventService.getEventById(created.id);

      expect(event).toBeDefined();
      expect(event.title).toBe("Find Me");
    });

    test("should throw not found for missing event", async () => {
      await expect(eventService.getEventById(9999)).rejects.toThrow(
        "Event not found",
      );
    });
  });

  describe("uploadEventImage", () => {
    beforeEach(() => {
      cloudinaryService.uploadImage.mockReset();
      cloudinaryService.deleteImage.mockReset();
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/gigspass/events/1/new-image.jpg",
      });
      cloudinaryService.deleteImage.mockResolvedValue({ result: "ok" });
    });

    test("should upload image and update event image_url", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });

      const updated = await eventService.uploadEventImage(
        "org-1",
        created.id,
        createMockImageFile(),
      );

      expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(1);
      expect(updated).toBeDefined();
      expect(updated.image_url).toContain("new-image.jpg");
    });

    test("should reject upload by non-owner", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.uploadEventImage("org-2", created.id, createMockImageFile()),
      ).rejects.toThrow("only event owner");
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    });

    test("should reject upload for non-existent event", async () => {
      await expect(
        eventService.uploadEventImage("org-1", 9999, createMockImageFile()),
      ).rejects.toThrow("Event not found");
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    });

    test("should reject missing file", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.uploadEventImage("org-1", created.id, null),
      ).rejects.toThrow("Image file is required");
    });

    test("should reject invalid file type", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.uploadEventImage(
          "org-1",
          created.id,
          createMockImageFile({ mimetype: "text/plain" }),
        ),
      ).rejects.toThrow("Invalid image type");
    });

    test("should reject oversized file", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });

      await expect(
        eventService.uploadEventImage(
          "org-1",
          created.id,
          createMockImageFile({ size: 6 * 1024 * 1024 }),
        ),
      ).rejects.toThrow("Image too large");
    });

    test("should delete old image when replacing", async () => {
      const created = await eventService.createEvent("org-1", {
        title: "Image Event",
        event_date: FUTURE_DATE,
      });
      await eventModel.updateImage(created.id, "https://res.cloudinary.com/demo/image/upload/v1/gigspass/events/1/old-image.jpg");

      await eventService.uploadEventImage("org-1", created.id, createMockImageFile());

      expect(cloudinaryService.deleteImage).toHaveBeenCalledTimes(1);
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith("old-image");
    });
  });
});
