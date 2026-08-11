jest.mock("../../src/services/lockService", () => ({
  cleanupExpiredLocks: jest.fn(),
}));
jest.mock("../../src/services/queueService", () => ({
  dequeueBatch: jest.fn(),
}));
jest.mock("../../src/models/categoryModel", () => ({
  findAll: jest.fn(),
}));

const queueDequeuer = require("../../src/jobs/queueDequeuer");
const lockService = require("../../src/services/lockService");
const queueService = require("../../src/services/queueService");
const categoryModel = require("../../src/models/categoryModel");

describe("Queue Dequeuer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueDequeuer.stop();
  });

  describe("processQueueForCategory", () => {
    test("cleans expired locks before dequeuing", async () => {
      queueService.dequeueBatch.mockResolvedValue([]);

      await queueDequeuer.processQueueForCategory("cat-1");

      const callOrder = lockService.cleanupExpiredLocks.mock.invocationCallOrder[0];
      const dequeueCallOrder = queueService.dequeueBatch.mock.invocationCallOrder[0];
      expect(callOrder).toBeLessThan(dequeueCallOrder);
      expect(lockService.cleanupExpiredLocks).toHaveBeenCalledWith("cat-1");
      expect(queueService.dequeueBatch).toHaveBeenCalledWith(
        "cat-1",
        expect.any(Number),
      );
    });

    test("does not dequeue when cleanup throws", async () => {
      lockService.cleanupExpiredLocks.mockRejectedValue(
        new Error("redis down"),
      );

      const result = await queueDequeuer.processQueueForCategory("cat-1");

      expect(queueService.dequeueBatch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("run", () => {
    test("iterates over all categories", async () => {
      categoryModel.findAll.mockResolvedValue([{ id: "cat-1" }, { id: "cat-2" }]);
      lockService.cleanupExpiredLocks.mockResolvedValue(0);
      queueService.dequeueBatch.mockResolvedValue([]);

      await queueDequeuer.run();

      expect(lockService.cleanupExpiredLocks).toHaveBeenCalledTimes(2);
      expect(lockService.cleanupExpiredLocks).toHaveBeenCalledWith("cat-1");
      expect(lockService.cleanupExpiredLocks).toHaveBeenCalledWith("cat-2");
      expect(queueService.dequeueBatch).toHaveBeenCalledTimes(2);
    });

    test("skips next tick while a run is in progress", async () => {
      categoryModel.findAll.mockResolvedValue([{ id: "cat-1" }]);
      let releaseRun;
      const gate = new Promise((resolve) => {
        releaseRun = resolve;
      });
      lockService.cleanupExpiredLocks.mockImplementation(() => gate);

      const firstRun = queueDequeuer.run();
      await new Promise((resolve) => setImmediate(resolve));
      const secondRun = queueDequeuer.run();
      releaseRun();

      await Promise.all([firstRun, secondRun]);

      expect(categoryModel.findAll).toHaveBeenCalledTimes(1);
      expect(lockService.cleanupExpiredLocks).toHaveBeenCalledTimes(1);
    });
  });
});
