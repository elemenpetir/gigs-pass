const request = require("supertest");
const { truncateAll } = require("../setup/cleanup");

let seq = 0;

const uniqueEmail = (prefix = "user") =>
  `${prefix}_${Date.now()}_${++seq}@test.com`;

const registerUser = async (app, { email, password, role, name }) => {
  return request(app).post("/api/auth/register").send({
    email,
    password,
    role,
    name,
  });
};

const login = async (app, email, password) => {
  return request(app).post("/api/auth/login").send({ email, password });
};

const registerAndLogin = async (app, { role, name, password = "Password123!" }) => {
  const email = uniqueEmail(role);
  const reg = await registerUser(app, { email, password, role, name });
  if (reg.status !== 201) {
    throw new Error(`register failed: ${JSON.stringify(reg.body)}`);
  }
  const loginRes = await login(app, email, password);
  return { email, token: loginRes.body.data.token, user: reg.body.data.user };
};

module.exports = {
  truncateAll,
  uniqueEmail,
  registerUser,
  login,
  registerAndLogin,
};
