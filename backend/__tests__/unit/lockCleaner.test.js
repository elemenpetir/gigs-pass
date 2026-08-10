jest.mock("../../src/models/categoryModel");
jest.mock("../../src/models/orderModel");
jest.mock("../../src/config/redis", () => ({
  zrangebyscore: jest.fn(),
  pipeline: jest.fn(),
}));

const lockCleaner = require("../../src/jobs/lockCleaner");
const categoryModel = require("../../src/models/categoryModel");
const orderModel = require("../../src/models/orderModel");
const redis = require("../../src/config/redis");

const mockPipeline = () => {
  const pipeline = {
    del: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    zrem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  redis.pipeline.mockReturnValue(pipeline);
  return pipeline;
};

describe("Lock Cleaner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processCategory", () => {
    test("releases expired locks and marks orders expired", async () => {
      redis.zrangebyscore.mockResolvedValue(["buyer-1", "buyer-2"]);
      const pipeline = mockPipeline();

      const released = await lockCleaner.processCategory("cat-1");

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

      const released = await lockCleaner.processCategory("cat-1");

      expect(released).toBe(0);
      expect(redis.pipeline).not.toHaveBeenCalled();
      expect(orderModel.markExpiredByBuyerAndCategory).not.toHaveBeenCalled();
    });
  });

  describe("run", () => {
    test("iterates over all categories", async () => {
      categoryModel.findAll.mockResolvedValue([{ id: "cat-1" }, { id: "cat-2" }]);
      redis.zrangebyscore.mockResolvedValue([]);

      await lockCleaner.run();

      expect(redis.zrangebyscore).toHaveBeenCalledTimes(2);
      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        "lockexpiry:category:cat-1",
        0,
        expect.any(Number),
      );
      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        "lockexpiry:category:cat-2",
        0,
        expect.any(Number),
      );
    });
  });
});
