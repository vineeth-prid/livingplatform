// k6 load profile for the Living API.
//
// Runs from a machine that is NOT the VPS, straight at the API port, bypassing
// CloudPanel nginx and Cloudflare — so this measures Living, not the shared
// edge, and cannot saturate the proxy every other site on that box depends on.
//
//   k6 run -e BASE=http://<vps-ip>:8104/api/v1 \
//          -e COMMUNITY_ID=<uuid> \
//          -e RESIDENT_USER=... -e RESIDENT_PASS=... \
//          -e GUARD_USER=...    -e GUARD_PASS=... \
//          -e STAFF_USER=...    -e STAFF_PASS=... \
//          -e ADMIN_USER=...    -e ADMIN_PASS=... \
//          --out csv=k6-results.csv loadtest/living.js
//
// PROFILE=baseline|load|stress|soak  (default: load)
import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE = __ENV.BASE || fail('set -e BASE=http://<vps-ip>:8104/api/v1');
const COMMUNITY = __ENV.COMMUNITY_ID || fail('set -e COMMUNITY_ID=<uuid>');
const PROFILE = __ENV.PROFILE || 'load';

const ttfb = new Trend('endpoint_ttfb', true);
const throttled = new Counter('throttled_429');
const serverErrors = new Rate('server_5xx');
const sseHeld = new Counter('sse_connections_held');

// ── shaping ──────────────────────────────────────────────────────────────────
// Ramps are deliberately gradual. A vertical ramp measures how fast a cold pool
// warms up, not how much the system can carry.
const PROFILES = {
  // One user, no concurrency. Establishes what "fast" means before load hides it.
  baseline: { executor: 'constant-vus', vus: 1, duration: '2m' },
  // Realistic peak: a morning in a mid-size community.
  load: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
  // Push until it bends. The envelope on the VPS is what keeps this contained.
  stress: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '3m', target: 200 },
      { duration: '3m', target: 400 },
      { duration: '2m', target: 0 },
    ],
  },
  // Leak hunt. Flat and long; watch RSS and connection counts in the watchdog CSV.
  soak: { executor: 'constant-vus', vus: 25, duration: '90m' },
};

export const options = {
  discardResponseBodies: false,
  scenarios: {
    resident: { ...PROFILES[PROFILE], exec: 'resident', tags: { role: 'resident' } },
    guard: { ...PROFILES[PROFILE], exec: 'guard', tags: { role: 'guard' },
      startTime: '5s', ...(PROFILE === 'baseline' ? {} : { stages: scale(PROFILES[PROFILE].stages, 0.4) }) },
    staff: { ...PROFILES[PROFILE], exec: 'staff', tags: { role: 'staff' },
      startTime: '10s', ...(PROFILE === 'baseline' ? {} : { stages: scale(PROFILES[PROFILE].stages, 0.3) }) },
    // The expensive aggregates. Few users, disproportionate cost.
    admin: { executor: 'constant-vus', vus: PROFILE === 'baseline' ? 1 : 3, duration: durationOf(PROFILE), exec: 'admin', tags: { role: 'admin' } },
    // Nobody has ever measured how many of these the box will hold.
    sse: { executor: 'constant-vus', vus: PROFILE === 'stress' ? 100 : 20, duration: durationOf(PROFILE), exec: 'sseHold', tags: { role: 'sse' } },
  },
  thresholds: {
    // abortOnFail is the self-stop: if the watchdog revokes our firewall rule,
    // every request fails, this trips within seconds and k6 exits on its own.
    'http_req_failed': [{ threshold: 'rate<0.25', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{role:resident}': ['p(95)<1500'],
    'http_req_duration{role:guard}': ['p(95)<1500'],
    'server_5xx': ['rate<0.05'],
  },
};

function scale(stages, f) {
  return stages ? stages.map((s) => ({ ...s, target: Math.max(1, Math.round(s.target * f)) })) : undefined;
}
function durationOf(p) {
  return { baseline: '2m', load: '15m', stress: '13m', soak: '90m' }[p];
}

// ── auth ─────────────────────────────────────────────────────────────────────
// POST /auth/login is throttled to 5/min per IP (auth.controller.ts:48), which
// is far tighter than the global limit. So: log in once per ROLE in setup(),
// spaced out, and hand the tokens to every VU. VUs never log in themselves.
function login(username, password) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = http.post(`${BASE}/auth/login`, JSON.stringify({ username, password }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/login' },
    });
    if (res.status === 200) return res.json('accessToken') || res.json('access_token');
    if (res.status === 429) { console.warn(`login throttled for ${username}, backing off 30s`); sleep(30); continue; }
    fail(`login failed for ${username}: ${res.status} ${res.body}`);
  }
  fail(`login for ${username} never got past the rate limiter`);
}

export function setup() {
  const t = {};
  const creds = [
    ['resident', __ENV.RESIDENT_USER, __ENV.RESIDENT_PASS],
    ['guard', __ENV.GUARD_USER, __ENV.GUARD_PASS],
    ['staff', __ENV.STAFF_USER, __ENV.STAFF_PASS],
    ['admin', __ENV.ADMIN_USER, __ENV.ADMIN_PASS],
  ];
  for (const [role, u, p] of creds) {
    if (!u || !p) { console.warn(`no credentials for ${role} — that scenario will be skipped`); continue; }
    t[role] = login(u, p);
    sleep(13); // stay under 5 logins/min
  }
  return { tokens: t };
}

const H = (tok) => ({ headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' } });

function get(path, tok, name) {
  const res = http.get(`${BASE}${path}`, { ...H(tok), tags: { name } });
  record(res, name);
  return res;
}
function record(res, name) {
  ttfb.add(res.timings.waiting, { name });
  if (res.status === 429) throttled.add(1, { name });
  serverErrors.add(res.status >= 500, { name });
  check(res, { [`${name} ok`]: (r) => r.status >= 200 && r.status < 400 });
}

// ── scenarios ────────────────────────────────────────────────────────────────

// Opening the resident app and looking around. The dominant traffic shape.
export function resident(data) {
  const tok = data.tokens.resident;
  if (!tok) return;
  get('/residents/me', tok, 'GET /residents/me');
  get(`/communities/${COMMUNITY}/maintenance-invoices/my-dues`, tok, 'GET /my-dues');
  const list = get(`/communities/${COMMUNITY}/tickets?page=1&limit=20`, tok, 'GET /tickets');
  get(`/communities/${COMMUNITY}/service-requests?page=1&limit=20`, tok, 'GET /service-requests');

  // Drill into a ticket ~1 in 3 visits.
  const items = list.status === 200 ? (list.json('data') || list.json('items') || []) : [];
  if (items.length && Math.random() < 0.34) {
    const id = items[Math.floor(Math.random() * items.length)].id;
    if (id) {
      get(`/tickets/${id}`, tok, 'GET /tickets/:id');
      get(`/tickets/${id}/timeline`, tok, 'GET /tickets/:id/timeline');
    }
  }

  // Writes are the minority of traffic but they are what contends for the pool.
  if (Math.random() < 0.05) {
    const res = http.post(`${BASE}/communities/${COMMUNITY}/tickets`, JSON.stringify({
      title: `[loadtest] ${__VU}-${__ITER}`,
      description: 'Generated by k6. Safe to bulk-delete by this title prefix.',
      priority: 'LOW',
    }), { ...H(tok), tags: { name: 'POST /tickets' } });
    record(res, 'POST /tickets');
  }
  sleep(Math.random() * 3 + 2);
}

// Gate console: high-frequency polling plus delivery logging.
export function guard(data) {
  const tok = data.tokens.guard;
  if (!tok) return;
  get('/gate/deliveries/mine', tok, 'GET /gate/deliveries/mine');
  get('/gate/deliveries/statistics', tok, 'GET /gate/statistics');
  sleep(Math.random() * 2 + 1);
}

// Workforce app: a technician working their queue.
export function staff(data) {
  const tok = data.tokens.staff;
  if (!tok) return;
  get('/work-orders/mine', tok, 'GET /work-orders/mine');
  get(`/communities/${COMMUNITY}/work-orders?page=1&limit=20`, tok, 'GET /work-orders');
  sleep(Math.random() * 4 + 3);
}

// The aggregate queries. Cheap at 20 rows, and the first thing to fall over at
// 50k — which is exactly why the dataset has to be realistic before you believe
// any number this scenario produces.
export function admin(data) {
  const tok = data.tokens.admin;
  if (!tok) return;
  get(`/communities/${COMMUNITY}/tickets/dashboard`, tok, 'GET /tickets/dashboard');
  get(`/communities/${COMMUNITY}/insights`, tok, 'GET /insights');
  get(`/communities/${COMMUNITY}/maintenance-invoices/summary`, tok, 'GET /invoices/summary');
  sleep(10);
}

// Held-open SSE streams. k6 has no native SSE client, so this holds the request
// until timeout rather than parsing events — which is the right test anyway:
// the question is how many concurrent streams the process will carry, and what
// that does to its RSS. Read the answer from the watchdog CSV, not from here.
export function sseHold(data) {
  const tok = data.tokens.guard || data.tokens.resident;
  if (!tok) return;
  const res = http.get(`${BASE}/realtime/stream?communityId=${COMMUNITY}&rooms=gate`, {
    ...H(tok), timeout: '60s', tags: { name: 'SSE /realtime/stream' },
  });
  // status 0 = we hit our own timeout with the stream still open. Success.
  if (res.status === 0 || res.status === 200) sseHeld.add(1);
  else check(res, { 'sse accepted': () => false });
}
