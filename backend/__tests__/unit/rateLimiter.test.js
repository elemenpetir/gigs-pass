process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_LOGIN_MAX = "5";
process.env.RATE_LIMIT_REGISTER_MAX = "3";
process.env.RATE_LIMIT_JOIN_MAX = "4";
process.env.RATE_LIMIT_GLOBAL_MAX = "6";

const express = require("express");
const request = require("supertest");

const {
  loginLimiter,
  registerLimiter,
  joinLimiter,
  globalLimiter,
} = require("../../src/middlewares/rateLimiter");

delete process.env.RATE_LIMIT_WINDOW_MS;
delete process.env.RATE_LIMIT_LOGIN_MAX;
delete process.env.RATE_LIMIT_REGISTER_MAX;
delete process.env.RATE_LIMIT_JOIN_MAX;
delete process.env.RATE_LIMIT_GLOBAL_MAX;

const okHandler = (req, res) => res.status(200).json({ ok: true });
const unauthorizedHandler = (req, res) =>
  res.status(401).json({ status: "error", message: "Invalid credentials" });

const buildApp = (limiter, handler) => {
  const app = express();
  app.set("trust proxy", true);
  app.post("/hit", limiter, handler);
  return app;
};

describe("Rate Limiters", () => {
  describe("loginLimiter", () => {
    const failApp = buildApp(loginLimiter, unauthorizedHandler);
    const successApp = buildApp(loginLimiter, okHandler);

    it("memblokir setelah melewati batas percobaan gagal dari IP yang sama", async () => {
      for (let i = 0; i < 5; i++) {
        await request(failApp)
          .post("/hit")
          .set("X-Forwarded-For", "10.1.0.1")
          .expect(401);
      }
      const res = await request(failApp)
        .post("/hit")
        .set("X-Forwarded-For", "10.1.0.1")
        .expect(429);
      expect(res.body.status).toBe("error");
      expect(typeof res.body.message).toBe("string");
    });

    it("tidak memblokir IP lain yang masih di bawah batas", async () => {
      await request(failApp)
        .post("/hit")
        .set("X-Forwarded-For", "10.1.0.2")
        .expect(401);
    });

    it("tidak menghitung login sukses terhadap jatah (skipSuccessfulRequests)", async () => {
      for (let i = 0; i < 20; i++) {
        await request(successApp)
          .post("/hit")
          .set("X-Forwarded-For", "10.1.0.3")
          .expect(200);
      }
    });
  });

  describe("registerLimiter", () => {
    const app = buildApp(registerLimiter, okHandler);

    it("menghitung SEMUA request termasuk yang sukses", async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/hit")
          .set("X-Forwarded-For", "10.2.0.1")
          .expect(200);
      }
      const res = await request(app)
        .post("/hit")
        .set("X-Forwarded-For", "10.2.0.1")
        .expect(429);
      expect(res.body.status).toBe("error");
    });
  });

  describe("joinLimiter", () => {
    const buildJoinApp = () => {
      const app = express();
      app.set("trust proxy", true);
      app.use((req, res, next) => {
        req.user = { id: req.get("x-user-id") || "anon" };
        next();
      });
      app.post("/join", joinLimiter, okHandler);
      return app;
    };

    const app = buildJoinApp();

    it("memblokir per-user setelah melewati batas tanpa menimpa user lain", async () => {
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post("/join")
          .set("x-user-id", "user-1")
          .expect(200);
      }
      const res = await request(app)
        .post("/join")
        .set("x-user-id", "user-1")
        .expect(429);
      expect(res.body.status).toBe("error");

      await request(app).post("/join").set("x-user-id", "user-2").expect(200);
    });
  });

  describe("globalLimiter", () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(globalLimiter);
    app.get("/live/stream", okHandler);
    app.get("/live/other", okHandler);

    it("mengecualikan path SSE */stream dari hitungan global", async () => {
      for (let i = 0; i < 15; i++) {
        await request(app)
          .get("/live/stream")
          .set("X-Forwarded-For", "10.4.0.1")
          .expect(200);
      }
    });

    it("menghitung request biasa dan tetap meloloskan stream pada IP yang sama", async () => {
      for (let i = 0; i < 6; i++) {
        await request(app)
          .get("/live/other")
          .set("X-Forwarded-For", "10.4.0.2")
          .expect(200);
      }
      const res = await request(app)
        .get("/live/other")
        .set("X-Forwarded-For", "10.4.0.2")
        .expect(429);
      expect(res.body.status).toBe("error");

      await request(app)
        .get("/live/stream")
        .set("X-Forwarded-For", "10.4.0.2")
        .expect(200);
    });
  });
});
