let idCounter = 1;
let eventIdCounter = 1;

const mockDb = {
  users: [],
  events: [],

  reset() {
    this.users = [];
    this.events = [];
    idCounter = 1;
    eventIdCounter = 1;
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

    if (sql.includes("FROM events WHERE id")) {
      const [id] = params;
      const event = this.events.find((e) => e.id === id);
      return Promise.resolve({ rows: event ? [event] : [], rowCount: event ? 1 : 0 });
    }

    return Promise.resolve({ rows: [], rowCount: 0 });
  },
};

module.exports = mockDb;
