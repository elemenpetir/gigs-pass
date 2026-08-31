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
const EVENT_ID = __ENV.EVENT_ID || '2d116749-d076-411c-92be-4e5e92f8bd24';
const CATEGORY_ID = __ENV.CATEGORY_ID || '5cdc3036-83cd-4436-9af9-ed30082ae49d';

export function setup() {
  // Logic to get valid IDs if not provided would go here
}

export default function () {
  const eventId = EVENT_ID;
  const categoryId = CATEGORY_ID;
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

  // 3. Join Queue
  res = http.post(`${BASE_URL}/api/queue/${categoryId}/join`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'join queue 200/409': (r) => r.status === 200 || r.status === 409 });

  // 4. Simulate Waiting (Polling/Stream) - simplified for load test
  // In real k6, using EventSource might be complex, we poll status
  res = http.get(`${BASE_URL}/api/queue/${categoryId}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: '10s'
  });
  
  // 5. Checkout if granted (simplified assumption)
  // Logic: if status is granted, do checkout (omitted for brevity in first pass)
  sleep(1);
}

