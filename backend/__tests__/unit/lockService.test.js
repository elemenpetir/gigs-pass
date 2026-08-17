const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);
jest.mock("../../src/models/orderModel", () => ({
  markExpiredByBuyerAndCategory: jest.fn(),
}));

jest.mock("../../src/config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  decr: jest.fn(),
  incr: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  pipeline: jest.fn(),
  zadd: jest.fn(),
  zrem: jest.fn(),
  zrangebyscore: jest.fn(),
  pttl: jest.fn(),
}));

const lockService = require("../../src/services/lockService");
const redis = require("../../src/config/redis");
const orderModel = require("../../src/models/orderModel");
const { LOCK_TTL_SECONDS } = require("../../src/config/constants");

const createCategory = async () => {
  const result = await mockDb.query("INSERT INTO ticket_categories", [
    1,
    "VIP",
    500000,
    100,
  ]);
  return result.rows[0];
};

describe("Lock Service", () => {
  beforeEach(() => {
    mockDb.reset();
    redis.get.mockReset();
    redis.set.mockReset();
    redis.decr.mockReset();
    redis.incr.mockReset();
    redis.del.mockReset();
    redis.exists.mockReset();
    redis.pipeline.mockReset();
    redis.zadd.mockReset();
    redis.zrem.mockReset();
    redis.zrangebyscore.mockReset();
    redis.pttl.mockReset();
    orderModel.markExpiredByBuyerAndCategory.mockReset();
  });

  describe("confirmSlot", () => {
    test("removes lock without incrementing stock", async () => {
      const category = await createCategory();
      redis.exists.mockResolvedValue(1);
      const pipeline = {
        del: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);

      const result = await lockService.confirmSlot("buyer-1", category.id);

      expect(result).toEqual({ confirmed: true });
      expect(pipeline.del).toHaveBeenCalledWith(
        `lock:category:${category.id}:buyer:buyer-1`,
      );
      expect(pipeline.zrem).toHaveBeenCalledWith(
        `lockexpiry:category:${category.id}`,
        "buyer-1",
      );
      expect(redis.incr).not.toHaveBeenCalled();
    });

    test("returns confirmed false when no lock exists", async () => {
      const category = await createCategory();
      redis.exists.mockResolvedValue(0);

      const result = await lockService.confirmSlot("buyer-1", category.id);

      expect(result).toEqual({ confirmed: false });
      expect(redis.del).not.toHaveBeenCalled();
    });

    test("throws 404 for unknown category", async () => {
      await expect(
        lockService.confirmSlot("buyer-1", 9999),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("releaseSlot", () => {
    test("removes lock and increments stock back", async () => {
      const category = await createCategory();
      redis.exists.mockResolvedValue(1);
      const pipeline = {
        del: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);

      const result = await lockService.releaseSlot("buyer-1", category.id);

      expect(result).toEqual({ released: true });
      expect(pipeline.del).toHaveBeenCalledWith(
        `lock:category:${category.id}:buyer:buyer-1`,
      );
      expect(pipeline.incr).toHaveBeenCalledWith(
        `stock:category:${category.id}`,
      );
      expect(pipeline.zrem).toHaveBeenCalledWith(
        `lockexpiry:category:${category.id}`,
        "buyer-1",
      );
    });

    test("returns released false when no lock exists", async () => {
      const category = await createCategory();
      redis.exists.mockResolvedValue(0);

      const result = await lockService.releaseSlot("buyer-1", category.id);

      expect(result).toEqual({ released: false });
      expect(redis.pipeline).not.toHaveBeenCalled();
    });

    test("throws 404 for unknown category", async () => {
      await expect(
        lockService.releaseSlot("buyer-1", 9999),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("getReservation", () => {
    test("returns remaining ttl when lock exists", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("1");
      redis.pttl.mockResolvedValue(180000);

      const result = await lockService.getReservation("buyer-1", category.id);

      expect(result).toEqual({
        reserved: true,
        expiresInSeconds: 180,
      });
    });

    test("falls back to full ttl when lock has no expiry", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("1");
      redis.pttl.mockResolvedValue(-1);

      const result = await lockService.getReservation("buyer-1", category.id);

      expect(result).toEqual({
        reserved: true,
        expiresInSeconds: LOCK_TTL_SECONDS,
      });
    });

    test("returns null when no lock exists", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue(null);

      const result = await lockService.getReservation("buyer-1", category.id);

      expect(result).toBeNull();
    });

    test("throws 404 for unknown category", async () => {
      await expect(
        lockService.getReservation("buyer-1", 9999),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("cleanupExpiredLocks", () => {
    test("releases expired locks and marks orders expired", async () => {
      redis.zrangebyscore.mockResolvedValue(["buyer-1", "buyer-2"]);
      const pipeline = {
        del: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);

      const released = await lockService.cleanupExpiredLocks("cat-1");

      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        "lockexpiry:category:cat-1",
        0,
        expect.any(Number),
      );
      expect(pipeline.del).toHaveBeenCalledWith(
        "lock:category:cat-1:buyer:buyer-1",
      );
      expect(pipeline.incr).toHaveBeenCalledWith("stock:category:cat-1");
      expect(pipeline.zrem).toHaveBeenCalledWith(
        "lockexpiry:category:cat-1",
        "buyer-1",
      );
      expect(orderModel.markExpiredByBuyerAndCategory).toHaveBeenCalledWith(
        "buyer-1",
        "cat-1",
      );
      expect(orderModel.markExpiredByBuyerAndCategory).toHaveBeenCalledWith(
        "buyer-2",
        "cat-1",
      );
      expect(released).toBe(2);
    });

    test("returns 0 when no locks expired", async () => {
      redis.zrangebyscore.mockResolvedValue([]);

      const released = await lockService.cleanupExpiredLocks("cat-1");

      expect(released).toBe(0);
      expect(redis.pipeline).not.toHaveBeenCalled();
      expect(orderModel.markExpiredByBuyerAndCategory).not.toHaveBeenCalled();
    });
  });
});
