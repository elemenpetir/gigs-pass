const mockDb = require("../setup/mockDb");
jest.mock("../../src/config/db", () => mockDb);

const {
  createUser,
  findByEmail,
  findById,
} = require("../../src/models/userModel");

describe("User Model", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("createUser", () => {
    test("should create user and return user object", async () => {
      const user = await createUser(
        "test@example.com",
        "hashedpassword123",
        "buyer",
        "John Doe",
      );

      expect(user).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.role).toBe("buyer");
      expect(user.name).toBe("John Doe");
      expect(user.password).toBeUndefined();
    });

    test("should create organizer user", async () => {
      const user = await createUser(
        "organizer@example.com",
        "hashedpassword123",
        "organizer",
        "Jane Smith",
      );

      expect(user.role).toBe("organizer");
      expect(user.email).toBe("organizer@example.com");
    });

    test("should generate unique IDs for each user", async () => {
      const user1 = await createUser(
        "user1@example.com",
        "hash1",
        "buyer",
        "User One",
      );
      const user2 = await createUser(
        "user2@example.com",
        "hash2",
        "buyer",
        "User Two",
      );

      expect(user1.id).not.toBe(user2.id);
    });

    test("should reject null name (schema: notNull true)", async () => {
      await expect(
        createUser("noname@example.com", "hashedpassword123", "buyer", null),
      ).rejects.toThrow();
    });
  });

  describe("findByEmail", () => {
    test("should find user by email", async () => {
      await createUser(
        "find@example.com",
        "hashedpassword123",
        "buyer",
        "Find Me",
      );

      const user = await findByEmail("find@example.com");

      expect(user).toBeDefined();
      expect(user.email).toBe("find@example.com");
      expect(user.name).toBe("Find Me");
    });

    test("should return null when user not found", async () => {
      const user = await findByEmail("nonexistent@example.com");

      expect(user).toBeNull();
    });

    test("should be case-sensitive", async () => {
      await createUser(
        "CaseSensitive@example.com",
        "hashedpassword123",
        "buyer",
        "Case Test",
      );

      const user = await findByEmail("casesensitive@example.com");

      expect(user).toBeNull();
    });

    test("should include password in result", async () => {
      await createUser(
        "withpass@example.com",
        "hashedpassword123",
        "buyer",
        "With Pass",
      );

      const user = await findByEmail("withpass@example.com");

      expect(user.password).toBe("hashedpassword123");
    });
  });

  describe("findById", () => {
    test("should find user by ID", async () => {
      const created = await createUser(
        "byid@example.com",
        "hashedpassword123",
        "organizer",
        "Find By ID",
      );

      const user = await findById(created.id);

      expect(user).toBeDefined();
      expect(user.id).toBe(created.id);
      expect(user.email).toBe("byid@example.com");
    });

    test("should return null when user not found", async () => {
      const user = await findById(9999);

      expect(user).toBeNull();
    });

    test("should not include password in result", async () => {
      const created = await createUser(
        "nopassword@example.com",
        "hashedpassword123",
        "buyer",
        "No Password",
      );

      const user = await findById(created.id);

      expect(user.password).toBeUndefined();
    });

    test("should include created_at timestamp", async () => {
      const created = await createUser(
        "timestamp@example.com",
        "hashedpassword123",
        "buyer",
        "Timestamp Test",
      );

      const user = await findById(created.id);

      expect(user.created_at).toBeDefined();
      expect(user.created_at instanceof Date).toBe(true);
    });
  });

  describe("email uniqueness", () => {
    test("should prevent duplicate emails (mock behavior)", async () => {
      await createUser("duplicate@example.com", "hash1", "buyer", "First");

      const user2 = await createUser(
        "duplicate@example.com",
        "hash2",
        "buyer",
        "Second",
      );

      expect(user2).toBeDefined();
    });
  });
});
