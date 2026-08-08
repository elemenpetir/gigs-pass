const request = require("supertest");
const app = require("../../../src/app");
const db = require("../../../src/config/db");
const eventModel = require("../../../src/models/eventModel");
const categoryModel = require("../../../src/models/categoryModel");
const userModel = require("../../../src/models/userModel");
const authService = require("../../../src/services/authService");
const {
  truncateAll,
  uniqueEmail,
  registerAndLogin,
} = require("./helpers");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const createAdminToken = async () => {
  const admin = await userModel.createUser(
    uniqueEmail("admin"),
    "hash-not-needed",
    "admin",
    "Admin",
  );
  return authService.generateJWT(admin.id, "admin");
};

const createPublishedEvent = async (app, token, title = "Festival") => {
  const created = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({ title, description: "Desc", event_date: FUTURE_DATE });
  expect(created.status).toBe(201);
  const eventId = created.body.data.event.id;

  const published = await request(app)
    .put(`/api/events/${eventId}/publish`)
    .set("Authorization", `Bearer ${token}`);
  expect(published.status).toBe(200);

  return eventId;
};

describe("Events (integration, real DB)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  test("organizer creates event as draft in real DB", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Festival", description: "Desc", event_date: FUTURE_DATE });

    expect(res.status).toBe(201);
    expect(res.body.data.event.status).toBe("draft");

    const dbEvent = await eventModel.findById(res.body.data.event.id);
    expect(dbEvent).not.toBeNull();
    expect(dbEvent.title).toBe("Festival");
    expect(dbEvent.organizer_id).toBeDefined();
  });

  test("publish draft event", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createPublishedEvent(app, token);

    const dbEvent = await eventModel.findById(eventId);
    expect(dbEvent.status).toBe("published");
  });

  test("non-owner organizer cannot publish (403)", async () => {
    const owner = await registerAndLogin(app, { role: "organizer", name: "OrgA" });
    const other = await registerAndLogin(app, { role: "organizer", name: "OrgB" });

    const created = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Festival", event_date: FUTURE_DATE });
    const eventId = created.body.data.event.id;

    const res = await request(app)
      .put(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${other.token}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
  });

  test("admin suspends published event", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createPublishedEvent(app, token);
    const adminToken = await createAdminToken();

    const res = await request(app)
      .put(`/api/events/${eventId}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.event.status).toBe("suspended");
  });

  test("cannot suspend event that already took place (400)", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const created = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Festival", event_date: FUTURE_DATE });
    const eventId = created.body.data.event.id;

    await eventModel.updateEvent(eventId, "Festival", null, PAST_DATE);
    await request(app)
      .put(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    const adminToken = await createAdminToken();
    const res = await request(app)
      .put(`/api/events/${eventId}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("already taken place");
  });

  test("cancel published event triggers refund_triggered on related orders", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createPublishedEvent(app, token);

    const buyer = await userModel.createUser(
      uniqueEmail("buyer"),
      "hash-not-needed",
      "buyer",
      "Buyer",
    );
    const category = await categoryModel.createCategory(eventId, "GA", 100, 10);
    const orderRes = await db.query(
      "INSERT INTO orders (buyer_id, category_id) VALUES ($1, $2) RETURNING id, status",
      [buyer.id, category.id],
    );
    expect(orderRes.rows[0].status).toBe("pending");
    const orderId = orderRes.rows[0].id;

    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.event.status).toBe("cancelled");

    const updated = await db.query("SELECT status FROM orders WHERE id = $1", [
      orderId,
    ]);
    expect(updated.rows[0].status).toBe("refund_triggered");
  });
});
