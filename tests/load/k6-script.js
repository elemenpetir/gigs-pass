import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    // 1. Steady Load: Constant 10 VUs for 1 minute
    steady_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      startTime: '0s',
    },
    // 2. Event Rush: Ramp up to 100 VUs in 30s, hold for 1m
    event_rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
      ],
      startTime: '1m10s', // Start after steady load
    },
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://13.214.56.223';

export function setup() {
  // Setup logic if needed
}

export default function (data) {
  const email = `user_${uuidv4()}@example.com`;
  const password = 'password123';

  // 1. Register
  let res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email, password, role: 'buyer', name: 'Test User'
  }), { headers: { 'Content-Type': 'application/json' } });
  
  check(res, { 'register status 201': (r) => r.status === 201 });

  // 2. Login
  res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login status 200': (r) => r.status === 200 });
  const token = res.json('data.token');

  // TODO: Add Queue Join + Checkout logic here
  // Needs variable eventId and categoryId
}
