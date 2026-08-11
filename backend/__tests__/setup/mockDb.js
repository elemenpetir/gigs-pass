let idCounter = 1;
let eventIdCounter = 1;
let categoryIdCounter = 1;
let orderIdCounter = 1;

const mockDb = {
  users: [],
  events: [],
  categories: [],
  orders: [],

  reset() {
    this.users = [];
    this.events = [];
    this.categories = [];
    this.orders = [];
    idCounter = 1;
    eventIdCounter = 1;
    categoryIdCounter = 1;
    orderIdCounter = 1;
  },

  query(sql, params) {
    if (sql.includes("INSERT INTO users")) {
      const [email, hashedPassword, role, name] = params;
      if (!name) {
        return Promise.reject(new Error('null value in column "name" violates not-null constraint'));
      }
      const id = idCounter++;
      const user = {
        id,
        email,
        password: hashedPassword,
        role,
        name,
        created_at: new Date(),
      };
      this.users.push(user);
      const { password, ...userWithoutPassword } = user;
      return Promise.resolve({ rows: [userWithoutPassword], rowCount: 1 });
    }

    if (sql.includes("SELECT * FROM users WHERE email")) {
      const [email] = params;
      const user = this.users.find((u) => u.email === email);
      return Promise.resolve({ rows: user ? [user] : [], rowCount: user ? 1 : 0 });
    }

    if (sql.includes("SELECT id, email, role, name, created_at FROM users WHERE id")) {
      const [id] = params;
      const user = this.users.find((u) => u.id === id);
      if (!user) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      const { password, ...userWithoutPassword } = user;
      return Promise.resolve({ rows: [userWithoutPassword], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO events")) {
      const [organizerId, title, description, eventDate] = params;
      if (!title) {
        return Promise.reject(new Error('null value in column "title" violates not-null constraint'));
      }
      const id = eventIdCounter++;
      const event = {
        id,
        organizer_id: organizerId,
        title,
        description,
        image_url: null,
        event_date: eventDate,
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.events.push(event);
      return Promise.resolve({ rows: [event], rowCount: 1 });
    }

    if (sql.includes("WHERE status = 'published'")) {
      const events = this.events.filter((e) => e.status === "published");
      return Promise.resolve({ rows: events, rowCount: events.length });
    }

    if (sql.includes("UPDATE events") && sql.includes("title = $2")) {
      const [id, title, description, eventDate] = params;
      const event = this.events.find((e) => e.id === id);
      if (!event) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      event.title = title;
      event.description = description;
      event.event_date = eventDate;
      event.updated_at = new Date();
      return Promise.resolve({ rows: [event], rowCount: 1 });
    }

    if (sql.includes("UPDATE events") && sql.includes("status = $2")) {
      const [id, status] = params;
      const event = this.events.find((e) => e.id === id);
      if (!event) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      event.status = status;
      event.updated_at = new Date();
      return Promise.resolve({ rows: [event], rowCount: 1 });
    }

    if (sql.includes("UPDATE events") && sql.includes("image_url = $2")) {
      const [id, imageUrl] = params;
      const event = this.events.find((e) => e.id === id);
      if (!event) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      event.image_url = imageUrl;
      event.updated_at = new Date();
      return Promise.resolve({ rows: [event], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO ticket_categories")) {
      const [eventId, name, price, quota] = params;
      const id = categoryIdCounter++;
      const category = {
        id,
        event_id: eventId,
        name,
        price,
        quota,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.categories.push(category);
      return Promise.resolve({ rows: [category], rowCount: 1 });
    }

    if (sql.includes("UPDATE ticket_categories")) {
      const [id, name, price, quota] = params;
      const category = this.categories.find((c) => c.id === id);
      if (!category) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      category.name = name;
      category.price = price;
      category.quota = quota;
      category.updated_at = new Date();
      return Promise.resolve({ rows: [category], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO orders")) {
      const [buyerId, categoryId, status] = params;
      const id = orderIdCounter++;
      const order = {
        id,
        buyer_id: buyerId,
        category_id: categoryId,
        status: status || "pending",
        holding_until: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.orders.push(order);
      return Promise.resolve({ rows: [order], rowCount: 1 });
    }

    if (sql.includes("UPDATE orders")) {
      const [eventId] = params;
      const matching = (this.orders || []).filter((order) => {
        const category = (this.categories || []).find(
          (c) => String(c.id) === String(order.category_id),
        );
        const belongsToEvent =
          category && String(category.event_id) === String(eventId);
        const paidStatus =
          sql.includes("status IN ('pending', 'holding_period')") &&
          ["pending", "holding_period"].includes(order.status);
        return belongsToEvent && (sql.includes("status IN") ? paidStatus : true);
      });
      matching.forEach((order) => {
        order.status = "refund_triggered";
        order.updated_at = new Date();
      });
      return Promise.resolve({ rows: matching, rowCount: matching.length });
    }

    if (sql.includes("FROM ticket_categories") && sql.includes("WHERE id = $1")) {
      const [id] = params;
      const category = this.categories.find((c) => c.id === id);
      return Promise.resolve({ rows: category ? [category] : [], rowCount: category ? 1 : 0 });
    }

    if (sql.includes("FROM ticket_categories") && sql.includes("WHERE event_id = $1")) {
      const [eventId] = params;
      const cats = this.categories.filter((c) => c.event_id === eventId);
      return Promise.resolve({ rows: cats, rowCount: cats.length });
    }

    if (sql.includes("FROM events WHERE id")) {
      const [id] = params;
      const event = this.events.find((e) => e.id === id);
      return Promise.resolve({ rows: event ? [event] : [], rowCount: event ? 1 : 0 });
    }

    return Promise.resolve({ rows: [], rowCount: 0 });
  },

  withTransaction: (fn) => fn(mockDb),
};

module.exports = mockDb;
