const userModel = require("../../../src/models/userModel");
const eventModel = require("../../../src/models/eventModel");
const categoryModel = require("../../../src/models/categoryModel");
const { truncateAll, uniqueEmail } = require("./helpers");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Models (integration, real DB constraints)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  test("createUser returns real DB row shape", async () => {
    const user = await userModel.createUser(
      uniqueEmail("model"),
      "hash",
      "buyer",
      "Model",
    );

    expect(user.id).toBeDefined();
    expect(user.created_at).toBeDefined();
    expect(user).not.toHaveProperty("password");
  });

  test("duplicate email violates unique constraint", async () => {
    const email = uniqueEmail("uniq");
    await userModel.createUser(email, "hash", "buyer", "A");

    await expect(
      userModel.createUser(email, "hash", "buyer", "B"),
    ).rejects.toThrow();
  });

  test("invalid role rejected by CHECK constraint", async () => {
    await expect(
      userModel.createUser(uniqueEmail("badrole"), "hash", "superuser", "Bad"),
    ).rejects.toThrow();
  });

  test("category with negative price violates CHECK constraint", async () => {
    const user = await userModel.createUser(
      uniqueEmail("org"),
      "hash",
      "organizer",
      "Org",
    );
    const event = await eventModel.createEvent(user.id, "Event", null, FUTURE_DATE, "music");

    await expect(
      categoryModel.createCategory(event.id, "GA", -100, 10),
    ).rejects.toThrow();
  });

  test("category with non-existent event violates FK constraint", async () => {
    await expect(
      categoryModel.createCategory(NON_EXISTENT_UUID, "GA", 100, 10),
    ).rejects.toThrow();
  });
});
