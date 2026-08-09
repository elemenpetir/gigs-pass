const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

jest.mock("../../src/services/queueService", () => ({
  joinQueue: jest.fn(),
  getQueuePosition: jest.fn(),
  dequeueBatch: jest.fn(),
}));

const queueController = require("../../src/controllers/queueController");
const queueService = require("../../src/services/queueService");

const createMockReqRes = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    chunks: [],
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    flushHeaders() {},
    write(chunk) {
      this.chunks.push(chunk);
    },
    end() {
      this.ended = true;
    },
  };
  return res;
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

describe("Queue Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("join", () => {
    test("should return 200 with position on successful join", async () => {
      queueService.joinQueue.mockResolvedValue({ queued: true, position: 3 });

      const req = { user: { id: "buyer-1" }, params: { categoryId: 1 } };
      const res = createMockReqRes();

      await queueController.join(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Joined the queue");
      expect(res.body.data).toEqual({ queued: true, position: 3 });
    });

    test("should return 404 when category not found", async () => {
      const error = new Error("Category not found");
      error.statusCode = 404;
      queueService.joinQueue.mockRejectedValue(error);

      const req = { user: { id: "buyer-1" }, params: { categoryId: 9999 } };
      const res = createMockReqRes();

      await queueController.join(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Category not found");
    });
  });

  describe("stream", () => {
    test("should push position then granted when buyer is dequeued", async () => {
      jest.useFakeTimers();
      queueService.getQueuePosition
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(null);

      const req = {
        user: { id: "buyer-1" },
        params: { categoryId: 1 },
        on: jest.fn(),
      };
      const res = createMockReqRes();

      queueController.stream(req, res);
      await flushMicrotasks();

      expect(res.headers["Content-Type"]).toBe("text/event-stream");

      const initialOutput = res.chunks.join("");
      expect(initialOutput).toContain("event: position");
      expect(initialOutput).toContain('"position":3');

      jest.advanceTimersByTime(2000);
      await flushMicrotasks();

      const output = res.chunks.join("");
      expect(output).toContain("event: granted");
      expect(res.ended).toBe(true);

      jest.useRealTimers();
    });
  });
});
