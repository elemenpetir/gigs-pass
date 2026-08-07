const {
  hashPassword,
  comparePassword,
  generateJWT,
  verifyJWT,
} = require("../../src/services/authService");

describe("Auth Service", () => {
  describe("hashPassword", () => {
    test("should hash password and return hashed value", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    test("should generate different hash for same password each time", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test("should hash empty string (validation happens in controller)", async () => {
      const hash = await hashPassword("");
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(20);
    });
  });

  describe("comparePassword", () => {
    test("should return true when password matches hash", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    test("should return false when password does not match hash", async () => {
      const password = "TestPassword123!";
      const wrongPassword = "WrongPassword123!";
      const hash = await hashPassword(password);
      const result = await comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    test("should be case-sensitive", async () => {
      const password = "TestPassword123!";
      const wrongCase = "testpassword123!";
      const hash = await hashPassword(password);
      const result = await comparePassword(wrongCase, hash);

      expect(result).toBe(false);
    });
  });

  describe("generateJWT", () => {
    test("should generate valid JWT token", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const role = "buyer";
      const token = generateJWT(userId, role);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    test("should include userId and role in token payload", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const role = "organizer";
      const token = generateJWT(userId, role);

      const decoded = verifyJWT(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
    });

    test("should generate different tokens for different inputs", () => {
      const token1 = generateJWT("user1", "buyer");
      const token2 = generateJWT("user2", "organizer");

      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyJWT", () => {
    test("should verify valid token and return decoded payload", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const role = "buyer";
      const token = generateJWT(userId, role);

      const decoded = verifyJWT(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
    });

    test("should throw error on invalid token", () => {
      const invalidToken = "invalid.token.here";
      expect(() => verifyJWT(invalidToken)).toThrow();
    });

    test("should throw error on malformed token", () => {
      const malformedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid";
      expect(() => verifyJWT(malformedToken)).toThrow();
    });
  });
});
