const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/config/redis", () => ({
  incr: jest.fn(),
  zadd: jest.fn(),
  zrank: jest.fn(),
  get: jest.fn(),
  zpopmin: jest.fn(),
  set: jest.fn(),
  decr: jest.fn(),
  del: jest.fn(),
}));

const queueService = require("../../src/services/queueService");
const redis = require("../../src/config/redis");
const { QUEUE_SEQ_KEY, LOCK_TTL_SECONDS } = require("../../src/config/constants");

const createCategory = async () => {
  const result = await mockDb.query("INSERT INTO ticket_categories", [
    1,
    "VIP",
    500000,
    100,
  ]);
  return result.rows[0];
};

describe("Queue Service", () => {
  beforeEach(() => {
    mockDb.reset();
    redis.incr.mockReset();
    redis.zadd.mockReset();
    redis.zrank.mockReset();
    redis.get.mockReset();
    redis.zpopmin.mockReset();
    redis.set.mockReset();
    redis.decr.mockReset();
    redis.del.mockReset();
  });

  describe("joinQueue", () => {
    test("assigns increasing scores in join order (FIFO)", async () => {
      const category = await createCategory();
      const key = queueService.queueKey(category.event_id, category.id);

      redis.incr
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);
      redis.zrank
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(2);
      redis.zadd.mockResolvedValue("OK");

      await queueService.joinQueue("buyer-1", category.id);
      await queueService.joinQueue("buyer-2", category.id);
      await queueService.joinQueue("buyer-3", category.id);

      expect(redis.zadd.mock.calls).toEqual([
        [key, 1, "buyer-1"],
        [key, 2, "buyer-2"],
        [key, 3, "buyer-3"],
      ]);
      expect(redis.incr).toHaveBeenCalledTimes(3);
      expect(redis.incr).toHaveBeenCalledWith(QUEUE_SEQ_KEY);
    });

    test("re-join does not add a duplicate member", async () => {
      const category = await createCategory();
      redis.zrank.mockResolvedValue(2);

      const result = await queueService.joinQueue("buyer-1", category.id);

      expect(result).toEqual({ queued: true, position: 3 });
      expect(redis.zadd).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    });

    test("rejects join when buyer already has an active order for the tier", async () => {
      const category = await createCategory();
      mockDb.orders.push({
        id: 1,
        buyer_id: "buyer-1",
        category_id: category.id,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        queueService.joinQueue("buyer-1", category.id),
      ).rejects.toThrow("You already have an active order for this tier");

      expect(redis.zadd).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    });

    test("allows join when buyer has only expired orders", async () => {
      const category = await createCategory();
      mockDb.orders.push({
        id: 1,
        buyer_id: "buyer-1",
        category_id: category.id,
        status: "expired",
        created_at: new Date(),
        updated_at: new Date(),
      });
      redis.zrank.mockResolvedValueOnce(null).mockResolvedValueOnce(0);
      redis.incr.mockResolvedValue(1);
      redis.zadd.mockResolvedValue("OK");

      const result = await queueService.joinQueue("buyer-1", category.id);

      expect(result).toEqual({ queued: true, position: 1 });
      expect(redis.zadd).toHaveBeenCalledWith(
        queueService.queueKey(category.event_id, category.id),
        1,
        "buyer-1",
      );
    });

    test("throws 404 for unknown category", async () => {
      await expect(queueService.joinQueue("buyer-1", 9999)).rejects.toThrow(
        "Category not found",
      );
    });
  });

  describe("getQueuePosition", () => {
    test("returns 1-based position", async () => {
      const category = await createCategory();
      redis.zrank.mockResolvedValue(2);

      const position = await queueService.getQueuePosition("buyer-1", category.id);

      expect(position).toBe(3);
    });

    test("returns null when buyer is not in queue", async () => {
      const category = await createCategory();
      redis.zrank.mockResolvedValue(null);

      const position = await queueService.getQueuePosition("buyer-x", category.id);

      expect(position).toBeNull();
    });

    test("throws 404 for unknown category", async () => {
      await expect(
        queueService.getQueuePosition("buyer-1", 9999),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("dequeueBatch", () => {
    test("caps batch by remaining stock and parses flat result", async () => {
      const category = await createCategory();
      const key = queueService.queueKey(category.event_id, category.id);
      redis.get.mockResolvedValue("3");
      redis.zpopmin.mockResolvedValue([
        "buyer-1",
        "1",
        "buyer-2",
        "2",
        "buyer-3",
        "3",
      ]);
      redis.set.mockResolvedValue("OK");
      redis.decr
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(redis.zpopmin).toHaveBeenCalledWith(key, 3);
      expect(dequeued).toEqual([
        { userId: "buyer-1", score: 1 },
        { userId: "buyer-2", score: 2 },
        { userId: "buyer-3", score: 3 },
      ]);
      expect(redis.decr).toHaveBeenCalledTimes(3);
    });

    test("sets seat lock with TTL and registers expiry for each admitted buyer", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("5");
      redis.zpopmin.mockResolvedValue(["buyer-1", "1", "buyer-2", "2"]);
      redis.set.mockResolvedValue("OK");
      redis.decr.mockResolvedValue(4);

      await queueService.dequeueBatch(category.id, 50);

      expect(redis.set.mock.calls).toEqual([
        [
          `lock:category:${category.id}:buyer:buyer-1`,
          "1",
          "EX",
          LOCK_TTL_SECONDS,
          "NX",
        ],
        [
          `lock:category:${category.id}:buyer:buyer-2`,
          "1",
          "EX",
          LOCK_TTL_SECONDS,
          "NX",
        ],
      ]);
      expect(redis.zadd.mock.calls).toEqual([
        [`lockexpiry:category:${category.id}`, expect.any(Number), "buyer-1"],
        [`lockexpiry:category:${category.id}`, expect.any(Number), "buyer-2"],
      ]);
    });

    test("does not create any lock when no buyers admitted", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("5");
      redis.zpopmin.mockResolvedValue([]);

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(dequeued).toEqual([]);
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.decr).not.toHaveBeenCalled();
    });

    test("returns empty when stock is zero", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("0");

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(dequeued).toEqual([]);
      expect(redis.zpopmin).not.toHaveBeenCalled();
    });

    test("uses full count when stock is not initialized", async () => {
      const category = await createCategory();
      const key = queueService.queueKey(category.event_id, category.id);
      redis.get.mockResolvedValue(null);
      redis.zpopmin.mockResolvedValue(["buyer-1", "1"]);
      redis.set.mockResolvedValue("OK");
      redis.decr.mockResolvedValue(4);

      const dequeued = await queueService.dequeueBatch(category.id, 5);

      expect(redis.zpopmin).toHaveBeenCalledWith(key, 5);
      expect(dequeued).toEqual([{ userId: "buyer-1", score: 1 }]);
    });

    test("rolls back slot when stock runs out mid-batch", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("2");
      redis.zpopmin.mockResolvedValue(["buyer-1", "1", "buyer-2", "2"]);
      redis.set.mockResolvedValue("OK");
      redis.decr.mockResolvedValueOnce(1).mockResolvedValueOnce(-1);

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(dequeued).toEqual([{ userId: "buyer-1", score: 1 }]);
      expect(redis.incr).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith(
        `lock:category:${category.id}:buyer:buyer-2`,
      );
    });

    test("skips buyer whose lock already exists", async () => {
      const category = await createCategory();
      redis.get.mockResolvedValue("5");
      redis.zpopmin.mockResolvedValue(["buyer-1", "1", "buyer-2", "2"]);
      redis.set.mockResolvedValueOnce(null).mockResolvedValueOnce("OK");
      redis.decr.mockResolvedValue(4);

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(dequeued).toEqual([{ userId: "buyer-2", score: 2 }]);
    });

    test("throws 404 for unknown category", async () => {
      await expect(queueService.dequeueBatch(9999, 50)).rejects.toThrow(
        "Category not found",
      );
    });
  });
});
