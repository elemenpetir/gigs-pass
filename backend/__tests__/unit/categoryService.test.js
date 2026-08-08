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

  describe("updateCategory", () => {
    test("should update category when owner and sync Redis stock on quota change", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });
      redis.set.mockClear();

      const updated = await categoryService.updateCategory("org-1", category.id, {
        name: "VVIP",
        price: 750000,
        quota: 50,
      });

      expect(updated).toBeDefined();
      expect(updated.name).toBe("VVIP");
      expect(updated.price).toBe(750000);
      expect(updated.quota).toBe(50);
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(`stock:category:${category.id}`, 50);
    });

    test("should not touch Redis stock when quota unchanged", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });
      redis.set.mockClear();

      await categoryService.updateCategory("org-1", category.id, {
        name: "VVIP",
      });

      expect(redis.set).not.toHaveBeenCalled();
    });

    test("should reject update by non-owner", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });

      await expect(
        categoryService.updateCategory("org-2", category.id, {
          name: "Hijacked",
        }),
      ).rejects.toThrow("only event owner can manage ticket categories");
    });

    test("should reject update of non-existent category", async () => {
      await expect(
        categoryService.updateCategory("org-1", 9999, {
          name: "Ghost",
        }),
      ).rejects.toThrow("Category not found");
    });

    test("should reject invalid name on update", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });

      await expect(
        categoryService.updateCategory("org-1", category.id, {
          name: "   ",
        }),
      ).rejects.toThrow("Category name must be a non-empty string");
    });

    test("should reject negative price on update", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });

      await expect(
        categoryService.updateCategory("org-1", category.id, {
          price: -1,
        }),
      ).rejects.toThrow("Price must be a non-negative integer");
    });

    test("should reject zero quota on update", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      const category = await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });

      await expect(
        categoryService.updateCategory("org-1", category.id, {
          quota: 0,
        }),
      ).rejects.toThrow("Quota must be a positive integer");
    });
  });

  describe("listCategoriesByEvent", () => {
    test("should return categories for an event", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });
      await categoryService.createCategory("org-1", event.id, {
        name: "VIP",
        price: 500000,
        quota: 100,
      });
      await categoryService.createCategory("org-1", event.id, {
        name: "GA",
        price: 100000,
        quota: 500,
      });

      const categories = await categoryService.listCategoriesByEvent(event.id);

      expect(categories).toHaveLength(2);
      expect(categories.map((c) => c.name)).toContain("VIP");
      expect(categories.map((c) => c.name)).toContain("GA");
    });

    test("should return empty array when event has no categories", async () => {
      const event = await eventService.createEvent("org-1", {
        title: "Concert",
        event_date: FUTURE_DATE,
      });

      const categories = await categoryService.listCategoriesByEvent(event.id);

      expect(categories).toEqual([]);
    });

    test("should reject listing categories of non-existent event", async () => {
      await expect(
        categoryService.listCategoriesByEvent(9999),
      ).rejects.toThrow("Event not found");
    });
  });
});
