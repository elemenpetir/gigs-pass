const request = require("supertest");
const app = require("../../../src/app");
const redis = require("../../../src/config/redis");
const { truncateAll, registerAndLogin } = require("./helpers");

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const createEvent = async (app, token) => {
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Festival", description: "Desc", event_date: FUTURE_DATE, category: "music" });
  expect(res.status).toBe(201);
  return res.body.data.event.id;
};

describe("Categories (integration, real DB + real Redis)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await redis.quit().catch(() => {});
  });

  test("create category initializes Redis stock = quota", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createEvent(app, token);

    const res = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "VIP", price: 500000, quota: 100 });

    expect(res.status).toBe(201);
    const categoryId = res.body.data.category.id;

    const stock = await redis.get(`stock:category:${categoryId}`);
    expect(Number(stock)).toBe(100);
  });

  test("update category syncs Redis stock on quota change", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createEvent(app, token);

    const created = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "VIP", price: 500000, quota: 100 });
    const categoryId = created.body.data.category.id;

    const res = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "VVIP", price: 750000, quota: 50 });

    expect(res.status).toBe(200);
    expect(res.body.data.category.quota).toBe(50);

    const stock = await redis.get(`stock:category:${categoryId}`);
    expect(Number(stock)).toBe(50);
  });

  test("list categories returns created ones (public)", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createEvent(app, token);

    await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "GA", price: 100000, quota: 500 });

    const res = await request(app).get(`/api/events/${eventId}/categories`);

    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].name).toBe("GA");
  });

  test("non-owner cannot create category (403)", async () => {
    const owner = await registerAndLogin(app, { role: "organizer", name: "OrgA" });
    const other = await registerAndLogin(app, { role: "organizer", name: "OrgB" });
    const eventId = await createEvent(app, owner.token);

    const res = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ name: "VIP", price: 500000, quota: 100 });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
  });

  test("list categories self-heals Redis stock after counter is lost", async () => {
    const { token } = await registerAndLogin(app, {
      role: "organizer",
      name: "Org",
    });
    const eventId = await createEvent(app, token);

    const created = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "VIP", price: 500000, quota: 100 });
    const categoryId = created.body.data.category.id;

    const res = await request(app).get(`/api/events/${eventId}/categories`);
    expect(res.status).toBe(200);
    expect(res.body.data.categories[0].stock).toBe(100);

    await redis.del(`stock:category:${categoryId}`);

    const heal = await request(app).get(`/api/events/${eventId}/categories`);
    expect(heal.status).toBe(200);
    expect(heal.body.data.categories[0].stock).toBe(100);

    const restored = await redis.get(`stock:category:${categoryId}`);
    expect(Number(restored)).toBe(100);
  });
});
