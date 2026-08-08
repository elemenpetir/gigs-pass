const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/config/redis", () => ({
  set: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
}));

const categoryService = require("../../src/services/categoryService");
const eventService = require("../../src/services/eventService");
const redis = require("../../src/config/redis");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

describe("Category Service", () => {
  beforeEach(() => {
    mockDb.reset();
    redis.set.mockClear();
  });

  describe("createCategory", () => {
    test("should create category and set Redis stock", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });

      expect(category).toBeDefined();
      expect(category.name).toBe("VIP");
      expect(category.price).toBe(500000);
      expect(category.quota).toBe(100);
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(`stock:category:${category.id}`, 100);
    });

    test("should reject category creation for non-existent event", async () => {
      await expect(
        categoryService.createCategory("org-1", 9999, {
          name: "VIP",
          price: 100,
          quota: 50,
        }),
      ).rejects.toThrow("Event not found");
    });

    test("should reject category creation by non-owner", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      await expect(
        categoryService.createCategory("org-2", event.id, {
          name: "VIP",
          price: 100,
          quota: 50,
        }),
      ).rejects.toThrow("only event owner can manage ticket categories");
    });

    test("should reject missing category name", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      await expect(
        categoryService.createCategory("org-1", event.id, {
          price: 100,
          quota: 50,
        }),
      ).rejects.toThrow("Category name is required");
    });

    test("should reject negative price", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      await expect(
        categoryService.createCategory("org-1", event.id, {
          name: "VIP",
          price: -10,
          quota: 50,
        }),
      ).rejects.toThrow("Price must be a non-negative integer");
    });

    test("should reject zero or negative quota", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      await expect(
        categoryService.createCategory("org-1", event.id, {
          name: "VIP",
          price: 100,
          quota: 0,
        }),
      ).rejects.toThrow("Quota must be a positive integer");
    });
  });
});
