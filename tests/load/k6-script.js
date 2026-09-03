import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.TARGET_URL || 'http://13.214.56.223';
const CATEGORY_ID = __ENV.CATEGORY_ID || 'b66b6216-6c9b-44b5-a5f2-27a9040a688f';

// ============================================
// SCENARIOS
// ============================================
export const options = {
  setupTimeout: '120s',
  scenarios: {
    join_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      stages: [
        { duration: '30s', target: 50 },    // warm-up
        { duration: '60s', target: 100 },   // baseline
        { duration: '60s', target: 200 },   // stress
        { duration: '60s', target: 300 },   // ceiling hunt
        { duration: '60s', target: 0 },     // cooldown
      ],
    },
    sse_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '60s', target: 100 },
        { duration: '60s', target: 200 },
        { duration: '60s', target: 300 },
        { duration: '60s', target: 0 },
      ],
      exec: 'sse_ramp',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const POOL_SIZE = 80;

export function setup() {
  const users = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const email = `load_${uuidv4()}@test.local`;
    const password = 'password123';
    const reg = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email, password, role: 'buyer', name: `Load User ${i}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    if (reg.status === 200 || reg.status === 201) {
      const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
        headers: { 'Content-Type': 'application/json' }
      });
      if (login.status === 200) {
        users.push({ token: login.json('data.token'), email, password });
      }
    }
  }
  console.log(`Setup: ${users.length}/${POOL_SIZE} users ready`);
  return { users, categoryId: CATEGORY_ID };
}

// ============================================
// PHASE 1: JOIN THROUGHPUT (fire-and-forget, no sleep)
// ============================================
export default function ({ users, categoryId }) {
  const u = users[Math.floor(Math.random() * users.length)];
  if (!u?.token) return;

  const res = http.post(`${BASE_URL}/api/queue/${categoryId}/join`, JSON.stringify({}), {
    headers: {
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'application/json',
    },
  });

  const ok = check(res, { 'join ok': (r) => r.status === 200 || r.status === 409 });
  if (!ok) console.log(`Join failed: ${res.status} ${res.body}`);
  // NO sleep — fire-and-forget for max throughput
}

// ============================================
// PHASE 2: CONCURRENT SSE (run with --scenario sse_ramp)
// ============================================
export function sse_ramp({ users, categoryId }) {
  const u = users[Math.floor(Math.random() * users.length)];
  if (!u?.token) return;

  // 1. Join queue first
  // NOTE: rate-limit bypass via header was removed (see rateLimiter.js) —
  // stress runs must use .env 99999 limits + no-limit nginx config instead.
  const joinRes = http.post(`${BASE_URL}/api/queue/${categoryId}/join`, JSON.stringify({}), {
    headers: {
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'application/json',
    },
  });
  if (joinRes.status !== 200 && joinRes.status !== 409) return;

  // 2. Open SSE stream (hold until granted or timeout)
  const streamRes = http.get(`${BASE_URL}/api/queue/${categoryId}/stream`, {
    headers: { Authorization: `Bearer ${u.token}` },
    tags: { name: 'sse_stream' },
    timeout: '120s',
  });

  check(streamRes, { 'sse connected': (r) => r.status === 200 });
  sleep(120); // max hold
}