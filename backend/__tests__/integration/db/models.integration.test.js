const userModel = require("../../../src/models/userModel");
const eventModel = require("../../../src/models/eventModel");
const categoryModel = require("../../../src/models/categoryModel");
const orderModel = require("../../../src/models/orderModel");
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

  const makeHoldingOrder = async () => {
    const org = await userModel.createUser(
      uniqueEmail("org"),
      "hash",
      "organizer",
      "Org",
    );
    const buyer = await userModel.createUser(
      uniqueEmail("buy"),
      "hash",
      "buyer",
      "Buy",
    );
    const event = await eventModel.createEvent(
      org.id,
      "Event",
      null,
      FUTURE_DATE,
      "music",
    );
    const category = await categoryModel.createCategory(
      event.id,
      "GA",
      100000,
      10,
    );
    const order = await orderModel.createOrder(buyer.id, category.id, 100000);
    await orderModel.markPaid(order.id);
    await orderModel.markHoldingPeriod(
      order.id,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    return order;
  };

  test("overrideStatus to held succeeds against real PG", async () => {
    const order = await makeHoldingOrder();

    const held = await orderModel.overrideStatus(order.id, "held");

    expect(held.status).toBe("held");
    expect(held.refund_reason).toBeNull();
  });

  test("overrideStatus to refunded sets admin_override reason", async () => {
    const order = await makeHoldingOrder();

    const refunded = await orderModel.overrideStatus(order.id, "refunded");

    expect(refunded.status).toBe("refunded");
    expect(refunded.refund_reason).toBe("admin_override");
  });
});
