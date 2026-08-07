const authenticate = require("../../src/middlewares/authenticate");
const authorize = require("../../src/middlewares/authorize");
const { generateJWT } = require("../../src/services/authService");

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

describe("authenticate middleware", () => {
  test("should attach user to req when valid token provided", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const token = generateJWT(userId, "buyer");
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockReqRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(userId);
    expect(req.user.role).toBe("buyer");
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test("should return 401 when no token provided", () => {
    const req = { headers: {} };
    const res = createMockReqRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("No token provided");
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 when header is not Bearer format", () => {
    const req = { headers: { authorization: "Basic abc123" } };
    const res = createMockReqRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("No token provided");
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 when token is invalid", () => {
    const req = { headers: { authorization: "Bearer invalid.token.here" } };
    const res = createMockReqRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 when token is tampered", () => {
    const token = generateJWT("user1", "buyer");
    const tampered = token.slice(0, -4) + "XXXX";
    const req = { headers: { authorization: `Bearer ${tampered}` } };
    const res = createMockReqRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorize middleware", () => {
  test("should allow access when role is permitted", () => {
    const req = { user: { id: "1", role: "buyer" } };
    const res = createMockReqRes();
    const next = jest.fn();

    const middleware = authorize(["buyer", "organizer"]);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test("should reject when role is not permitted", () => {
    const req = { user: { id: "1", role: "buyer" } };
    const res = createMockReqRes();
    const next = jest.fn();

    const middleware = authorize(["organizer"]);
    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden: insufficient role");
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 when req.user is not set", () => {
    const req = {};
    const res = createMockReqRes();
    const next = jest.fn();

    const middleware = authorize(["buyer"]);
    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  test("should allow admin when role is explicitly listed", () => {
    const req = { user: { id: "1", role: "admin" } };
    const res = createMockReqRes();
    const next = jest.fn();

    const middleware = authorize(["admin"]);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
