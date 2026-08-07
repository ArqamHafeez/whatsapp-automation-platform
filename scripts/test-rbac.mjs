/**
 * RBAC smoke test against a running API (default http://localhost:3000).
 * Run: npm run start:dev  then  node scripts/test-rbac.mjs
 */
const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function authed(path, token, method = 'GET') {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function main() {
  console.log(`Testing RBAC at ${baseUrl}\n`);

  const adminLogin = await login('admin@demo.com', 'admin123');
  const reviewerLogin = await login('reviewer@demo.com', 'reviewer123');

  if (adminLogin.status !== 201 && adminLogin.status !== 200) {
    console.error('Admin login failed', adminLogin.status, adminLogin.body);
    process.exit(1);
  }
  if (reviewerLogin.status !== 201 && reviewerLogin.status !== 200) {
    console.error('Reviewer login failed', reviewerLogin.status, reviewerLogin.body);
    console.error('Run: node prisma/seed.js');
    process.exit(1);
  }

  const adminToken = adminLogin.body.token;
  const reviewerToken = reviewerLogin.body.token;

  console.log('Admin role:', adminLogin.body.user?.role);
  console.log('Reviewer role:', reviewerLogin.body.user?.role);

  const checks = [
    ['Admin GET /connections', () => authed('/connections', adminToken), 200],
    ['Reviewer GET /connections (blocked)', () => authed('/connections', reviewerToken), 403],
    ['Reviewer GET /reviews', () => authed('/reviews', reviewerToken), 200],
    ['Reviewer GET /delivery/inbound', () => authed('/delivery/inbound', reviewerToken), 200],
    ['Reviewer GET /metrics/review-summary', () => authed('/metrics/review-summary', reviewerToken), 200],
    ['Reviewer GET /metrics/throughput (blocked)', () => authed('/metrics/throughput', reviewerToken), 403],
    ['Admin GET /users', () => authed('/users', adminToken), 200],
    ['Reviewer GET /users (blocked)', () => authed('/users', reviewerToken), 403],
  ];

  let failed = 0;
  for (const [label, fn, expected] of checks) {
    const status = await fn();
    const ok = status === expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} → ${status} (expected ${expected})`);
    if (!ok) failed += 1;
  }

  if (failed) {
    process.exit(1);
  }
  console.log('\nAll RBAC checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
