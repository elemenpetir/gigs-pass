const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

const {
  createEvent,
  findById,
  findPublished,
  updateEvent,
  updateStatus,
} = require("../../src/models/eventModel");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

describe("Event Model", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("createEvent", () => {
    test("should create event with draft status", async () => {
      const event = await createEvent(
        "org-1",
        "Music Festival",
        "Annual music festival",
        FUTURE_DATE,
      );

      expect(event).toBeDefined();
      expect(event.organizer_id).toBe("org-1");
      expect(event.title).toBe("Music Festival");
      expect(event.status).toBe("draft");
      expect(event.image_url).toBeNull();
    });

    test("should create event without description", async () => {
      const event = await createEvent("org-1", "Concert", null, FUTURE_DATE);

      expect(event).toBeDefined();
      expect(event.description).toBeNull();
    });

    test("should generate unique IDs for each event", async () => {
      const event1 = await createEvent("org-1", "Event One", null, FUTURE_DATE);
      const event2 = await createEvent("org-2", "Event Two", null, FUTURE_DATE);

      expect(event1.id).not.toBe(event2.id);
    });

    test("should reject null title (schema: notNull true)", async () => {
      await expect(
        createEvent("org-1", null, null, FUTURE_DATE),
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    test("should find event by id", async () => {
      const created = await createEvent(
        "org-1",
        "Find Event",
        "desc",
        FUTURE_DATE,
      );

      const event = await findById(created.id);

      expect(event).toBeDefined();
      expect(event.id).toBe(created.id);
      expect(event.title).toBe("Find Event");
      expect(event.organizer_id).toBe("org-1");
    });

    test("should return null when event not found", async () => {
      const event = await findById(9999);

      expect(event).toBeNull();
    });
  });

  describe("findPublished", () => {
    test("should return only published events", async () => {
      await createEvent("org-1", "Draft Event", null, FUTURE_DATE);

      const published = await createEvent(
        "org-2",
        "Published Event",
        null,
        FUTURE_DATE,
      );
      await updateStatus(published.id, "published");

      const events = await findPublished();

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Published Event");
    });

    test("should return empty array when no published events", async () => {
      const events = await findPublished();

      expect(events).toEqual([]);
    });
  });

  describe("updateEvent", () => {
    test("should update event fields", async () => {
      const created = await createEvent(
        "org-1",
        "Original Title",
        "Original desc",
        FUTURE_DATE,
      );

      const updated = await updateEvent(
        created.id,
        "New Title",
        "New desc",
        FUTURE_DATE,
      );

      expect(updated).toBeDefined();
      expect(updated.title).toBe("New Title");
      expect(updated.description).toBe("New desc");
    });

    test("should return null when updating non-existent event", async () => {
      const updated = await updateEvent(9999, "Title", "desc", FUTURE_DATE);

      expect(updated).toBeNull();
    });
  });

  describe("updateStatus", () => {
    test("should update event status", async () => {
      const created = await createEvent("org-1", "Status Event", null, FUTURE_DATE);

      const updated = await updateStatus(created.id, "published");

      expect(updated).toBeDefined();
      expect(updated.status).toBe("published");
    });

    test("should return null when event not found", async () => {
      const updated = await updateStatus(9999, "published");

      expect(updated).toBeNull();
    });
  });
});
