process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_LOGIN_MAX = "10";
process.env.RATE_LIMIT_REGISTER_MAX = "10";
process.env.RATE_LIMIT_JOIN_MAX = "30";
process.env.RATE_LIMIT_GLOBAL_MAX = "600";

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

// Synthetic validation of production defaults (10/10/30/600 per minute):
// pola sah harus 0% 429, pola abuse harus kena 429. Tanpa DB/Redis/server.
describe("Default-limit validation (synthetic sah vs abuse)", () => {
  describe("loginLimiter (10/menit/IP, sukses tidak makan jatah)", () => {
    const failApp = buildApp(loginLimiter, unauthorizedHandler);
    const successApp = buildApp(loginLimiter, okHandler);

    it("20 login sukses beruntun dari 1 IP tetap lolos", async () => {
      for (let i = 0; i < 20; i++) {
        await request(successApp)
          .post("/hit")
          .set("X-Forwarded-For", "10.5.0.1")
          .expect(200);
      }
    });

    it("10 gagal lolos, ke-11 kena 429, IP lain tidak ikut kena", async () => {
      for (let i = 0; i < 10; i++) {
        await request(failApp)
          .post("/hit")
          .set("X-Forwarded-For", "10.5.0.2")
          .expect(401);
      }
      const res = await request(failApp)
        .post("/hit")
        .set("X-Forwarded-For", "10.5.0.2")
        .expect(429);
      expect(res.body.status).toBe("error");

      await request(failApp)
        .post("/hit")
        .set("X-Forwarded-For", "10.5.0.3")
        .expect(401);
    });
  });

  describe("registerLimiter (10/menit/IP, hitung semua)", () => {
    const app = buildApp(registerLimiter, okHandler);

    it("10 register lolos, ke-11 kena 429", async () => {
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/hit")
          .set("X-Forwarded-For", "10.6.0.1")
          .expect(200);
      }
      const res = await request(app)
        .post("/hit")
        .set("X-Forwarded-For", "10.6.0.1")
        .expect(429);
      expect(res.body.status).toBe("error");
    });
  });

  describe("joinLimiter (30/menit/user, kebal NAT)", () => {
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

    it("30 join lolos, ke-31 kena 429, user lain tetap lolos", async () => {
      for (let i = 0; i < 30; i++) {
        await request(app)
          .post("/join")
          .set("x-user-id", "sweep-1")
          .expect(200);
      }
      const res = await request(app)
        .post("/join")
        .set("x-user-id", "sweep-1")
        .expect(429);
      expect(res.body.status).toBe("error");

      await request(app).post("/join").set("x-user-id", "sweep-2").expect(200);
    });
  });

  describe("globalLimiter (600/menit/IP, kecuali */stream)", () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(globalLimiter);
    app.get("/live/other", okHandler);
    app.get("/live/stream", okHandler);

    it("burst stream tidak makan jatah global", async () => {
      for (let i = 0; i < 15; i++) {
        await request(app)
          .get("/live/stream")
          .set("X-Forwarded-For", "10.7.0.1")
          .expect(200);
      }
    });

    it(
      "600 request biasa lolos, ke-601 kena 429, stream IP sama tetap lolos",
      async () => {
        for (let i = 0; i < 600; i++) {
          await request(app)
            .get("/live/other")
            .set("X-Forwarded-For", "10.7.0.2")
            .expect(200);
        }
        const res = await request(app)
          .get("/live/other")
          .set("X-Forwarded-For", "10.7.0.2")
          .expect(429);
        expect(res.body.status).toBe("error");

        await request(app)
          .get("/live/stream")
          .set("X-Forwarded-For", "10.7.0.2")
          .expect(200);
      },
      60000,
    );
  });
});
