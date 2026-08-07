const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

const authController = require("../../src/controllers/authController");

const createMockReqRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe("Auth Controller", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("register", () => {
    test("should create a buyer user and return 201", async () => {
      const req = {
        body: {
          email: "buyer@example.com",
          password: "Password123!",
          role: "buyer",
          name: "Buyer One",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe("buyer@example.com");
      expect(res.body.data.user.role).toBe("buyer");
      expect(res.body.data.user.password).toBeUndefined();
    });

    test("should create an organizer user and return 201", async () => {
      const req = {
        body: {
          email: "organizer@example.com",
          password: "Password123!",
          role: "organizer",
          name: "Organizer One",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user.role).toBe("organizer");
    });

    test("should reject duplicate email with 409", async () => {
      const req = {
        body: {
          email: "duplicate@example.com",
          password: "Password123!",
          role: "buyer",
          name: "First",
        },
      };

      await authController.register(req, createMockReqRes());

      const res2 = createMockReqRes();
      await authController.register(req, res2);

      expect(res2.statusCode).toBe(409);
      expect(res2.body.message).toBe("Email already registered");
    });

    test("should reject invalid email format with 400", async () => {
      const req = {
        body: {
          email: "not-an-email",
          password: "Password123!",
          role: "buyer",
          name: "Bad Email",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid email format");
    });

    test("should reject weak password with 400", async () => {
      const req = {
        body: {
          email: "weak@example.com",
          password: "short",
          role: "buyer",
          name: "Weak Pass",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Password must be at least 8 characters");
    });

    test("should reject invalid role with 400", async () => {
      const req = {
        body: {
          email: "admin@example.com",
          password: "Password123!",
          role: "admin",
          name: "Admin",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Role must be either buyer or organizer");
    });

    test("should reject missing name with 400", async () => {
      const req = {
        body: {
          email: "noname@example.com",
          password: "Password123!",
          role: "buyer",
          name: "",
        },
      };
      const res = createMockReqRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Name is required");
    });
  });

  describe("login", () => {
    test("should login successfully and return JWT token", async () => {
      const registerReq = {
        body: {
          email: "login@example.com",
          password: "Password123!",
          role: "buyer",
          name: "Login User",
        },
      };
      await authController.register(registerReq, createMockReqRes());

      const req = {
        body: {
          email: "login@example.com",
          password: "Password123!",
        },
      };
      const res = createMockReqRes();

      await authController.login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe("string");
      expect(res.body.data.user.email).toBe("login@example.com");
    });

    test("should reject wrong password with 401", async () => {
      const registerReq = {
        body: {
          email: "wrongpass@example.com",
          password: "Password123!",
          role: "buyer",
          name: "Wrong Pass",
        },
      };
      await authController.register(registerReq, createMockReqRes());

      const req = {
        body: {
          email: "wrongpass@example.com",
          password: "WrongPassword!",
        },
      };
      const res = createMockReqRes();

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Invalid email or password");
    });

    test("should reject non-existent email with 401", async () => {
      const req = {
        body: {
          email: "ghost@example.com",
          password: "Password123!",
        },
      };
      const res = createMockReqRes();

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Invalid email or password");
    });

    test("should reject missing credentials with 400", async () => {
      const req = { body: {} };
      const res = createMockReqRes();

      await authController.login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Email and password are required");
    });
  });

  describe("getMe", () => {
    test("should return current user data", async () => {
      const registerReq = {
        body: {
          email: "me@example.com",
          password: "Password123!",
          role: "organizer",
          name: "Me User",
        },
      };
      const registerRes = createMockReqRes();
      await authController.register(registerReq, registerRes);
      const createdUser = registerRes.body.data.user;

      const req = { user: { id: createdUser.id } };
      const res = createMockReqRes();

      await authController.getMe(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("me@example.com");
      expect(res.body.data.user.role).toBe("organizer");
      expect(res.body.data.user.password).toBeUndefined();
    });

    test("should return 404 when user not found", async () => {
      const req = { user: { id: 9999 } };
      const res = createMockReqRes();

      await authController.getMe(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("User not found");
    });
  });
});
