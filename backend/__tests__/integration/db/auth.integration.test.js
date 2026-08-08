const request = require("supertest");
const app = require("../../../src/app");
const userModel = require("../../../src/models/userModel");
const { truncateAll, uniqueEmail, registerUser, login } = require("./helpers");

describe("Auth (integration, real DB)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  test("register buyer persists user in real DB", async () => {
    const email = uniqueEmail("buyer");
    const res = await registerUser(app, {
      email,
      password: "Password123!",
      role: "buyer",
      name: "Buyer One",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email);

    const dbUser = await userModel.findByEmail(email);
    expect(dbUser).not.toBeNull();
    expect(dbUser.role).toBe("buyer");
    expect(dbUser.password).not.toBe("Password123!");
  });

  test("duplicate email rejected by real DB unique constraint (409)", async () => {
    const email = uniqueEmail("dup");
    const payload = { email, password: "Password123!", role: "buyer", name: "Dup" };

    const first = await registerUser(app, payload);
    expect(first.status).toBe(201);

    const dup = await registerUser(app, payload);
    expect(dup.status).toBe(409);
    expect(dup.body.status).toBe("error");
  });

  test("login returns token against real DB", async () => {
    const email = uniqueEmail("login");
    await registerUser(app, {
      email,
      password: "Password123!",
      role: "organizer",
      name: "Login",
    });

    const res = await login(app, email, "Password123!");
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
  });

  test("wrong password returns 401", async () => {
    const email = uniqueEmail("wrong");
    await registerUser(app, {
      email,
      password: "Password123!",
      role: "buyer",
      name: "Wrong",
    });

    const res = await login(app, email, "WrongPassword!");
    expect(res.status).toBe(401);
  });

  test("GET /me with token returns user from real DB", async () => {
    const email = uniqueEmail("me");
    await registerUser(app, {
      email,
      password: "Password123!",
      role: "buyer",
      name: "Me",
    });

    const loginRes = await login(app, email, "Password123!");
    const token = loginRes.body.data.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.password).toBeUndefined();
  });
});
