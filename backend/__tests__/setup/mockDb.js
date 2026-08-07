let idCounter = 1;

const mockDb = {
  users: [],

  reset() {
    this.users = [];
    idCounter = 1;
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

    return Promise.resolve({ rows: [], rowCount: 0 });
  },
};

module.exports = mockDb;
