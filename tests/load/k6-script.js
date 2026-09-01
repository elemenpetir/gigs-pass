import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
    },
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://13.214.56.223';
const CATEGORY_ID = __ENV.CATEGORY_ID || '5cdc3036-83cd-4436-9af9-ed30082ae49d';
const TEST_KEY = 'stress-test-secret';

export function setup() {
  const email = `test_${uuidv4()}@example.com`;
  const password = 'password123';

  // 1. Register
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({ email, password, role: 'buyer', name: 'Test User' }), {
    headers: { 'Content-Type': 'application/json', 'X-K6-TEST-KEY': TEST_KEY },
  });

  // 2. Login
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json', 'X-K6-TEST-KEY': TEST_KEY },
  });
  return { token: res.json('data.token') };
}

export default function (data) {
  const { token } = data;
  
  if (!token) {
    console.log('Token missing in iteration');
    return;
  }

  // 3. Join Queue
  const res = http.post(`${BASE_URL}/api/queue/${CATEGORY_ID}/join`, JSON.stringify({}), {
    headers: { 
      Authorization: `Bearer ${token}`, 
      'X-K6-TEST-KEY': TEST_KEY,
      'Content-Type': 'application/json' 
    },
  });
  
  if (res.status !== 200 && res.status !== 409) {
    console.log(`Join Queue Failed: ${res.status} - ${res.body}`);
  }
  
  check(res, { 'join queue ok': (r) => r.status === 200 || r.status === 409 });
  
  // Sleep 0.5s to respect nginx rate limits while keeping concurrency high
  sleep(0.5);
}
