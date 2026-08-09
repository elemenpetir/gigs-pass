const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/config/redis", () => ({
  incr: jest.fn(),
  zadd: jest.fn(),
  zrank: jest.fn(),
  get: jest.fn(),
  zpopmin: jest.fn(),
}));

const queueService = require("../../src/services/queueService");
const redis = require("../../src/config/redis");
const { QUEUE_SEQ_KEY } = require("../../src/config/constants");

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

      const dequeued = await queueService.dequeueBatch(category.id, 50);

      expect(redis.zpopmin).toHaveBeenCalledWith(key, 3);
      expect(dequeued).toEqual([
        { userId: "buyer-1", score: 1 },
        { userId: "buyer-2", score: 2 },
        { userId: "buyer-3", score: 3 },
      ]);
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

      const dequeued = await queueService.dequeueBatch(category.id, 5);

      expect(redis.zpopmin).toHaveBeenCalledWith(key, 5);
      expect(dequeued).toEqual([{ userId: "buyer-1", score: 1 }]);
    });
  });
});
