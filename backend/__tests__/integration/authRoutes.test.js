const request = require("supertest");
const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

const app = require("../../src/app");

describe("Auth Routes (integration)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("POST /api/auth/register", () => {
    test("should register a buyer successfully", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "buyer@example.com",
        password: "Password123!",
        role: "buyer",
        name: "Buyer One",
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("buyer@example.com");
    });

    test("should reject duplicate email", async () => {
      const payload = {
        email: "dup@example.com",
        password: "Password123!",
        role: "buyer",
        name: "Dup User",
      };

      await request(app).post("/api/auth/register").send(payload);
      const res = await request(app).post("/api/auth/register").send(payload);

      expect(res.status).toBe(409);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Email already registered");
    });

    test("should reject invalid payload", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "bad",
        password: "short",
        role: "admin",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
    });
  });

  describe("POST /api/auth/login", () => {
    test("should login and return token", async () => {
      await request(app).post("/api/auth/register").send({
        email: "login@example.com",
        password: "Password123!",
        role: "organizer",
        name: "Login User",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe("organizer");
    });

    test("should reject wrong credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nouser@example.com",
        password: "WrongPassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
    });
  });

  describe("GET /api/auth/me", () => {
    test("should return user data with valid token", async () => {
      await request(app).post("/api/auth/register").send({
        email: "me@example.com",
        password: "Password123!",
        role: "buyer",
        name: "Me User",
      });
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "me@example.com",
        password: "Password123!",
      });
      const token = loginRes.body.data.token;

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("me@example.com");
      expect(res.body.data.user.password).toBeUndefined();
    });

    test("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("No token provided");
    });

    test("should return 401 with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
    });
  });
});
