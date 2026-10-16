/**
 * Smoke test: Opportunity Circle integration admin + public API.
 *
 * Prerequisites:
 *   - npm run db:migrate && node prisma/seed.js
 *   - API running: npm run start:dev  (http://localhost:3000)
 *
 * Optional env for public API check (after rotate-key in dashboard):
 *   OC_API_KEY=oc_...
 *
 * Usage: node scripts/test-opportunity-circle-integration.mjs
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

async function authed(path, token, method = 'GET', body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.json().catch(() => ({}));
  return { status: res.status, body: text };
}

async function publicGet(path, apiKey) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  console.log(`WhatsApp platform OC integration test @ ${baseUrl}\n`);

  const adminLogin = await login('admin@demo.com', 'admin123');
  if (adminLogin.status !== 201 && adminLogin.status !== 200) {
    console.error('Admin login failed. Run: node prisma/seed.js');
    process.exit(1);
  }
  const token = adminLogin.body.token;

  let r = await authed('/admin/integrations/opportunity-circle', token);
  if (r.status !== 200) {
    console.error('GET integration failed', r.status, r.body);
    process.exit(1);
  }
  console.log('✓ GET integration', {
    enabled: r.body.integration?.enabled,
    sinkCount: r.body.integration?.sinkChatIds?.length ?? 0,
    hasApiKey: r.body.integration?.hasApiKey,
  });

  r = await authed('/admin/integrations/opportunity-circle/preview?limit=3', token);
  if (r.status !== 200) {
    console.error('Preview failed', r.status, r.body);
    process.exit(1);
  }
  const previewCount = r.body.preview?.count ?? 0;
  console.log(`✓ Preview endpoint (${previewCount} item(s))`);
  if (previewCount > 0) {
    const sample = r.body.preview.items[0];
    console.log('  sample:', {
      sentAt: sample.sentAt,
      category: sample.category,
      sourceChatTitle: sample.sourceChatTitle,
      bodyPreview: sample.bodyPreview?.slice(0, 80),
    });
  } else {
    console.log('  (no sink forwards yet — configure sinks and forward a test message)');
  }

  const apiKey = process.env.OC_API_KEY;
  if (apiKey) {
    r = await publicGet('/integrations/opportunity-circle/health', apiKey);
    if (r.status !== 200) {
      console.error('Public health failed', r.status, r.body);
      process.exit(1);
    }
    console.log('✓ Public health', r.body);

    r = await publicGet('/integrations/opportunity-circle/forwards?limit=5', apiKey);
    if (r.status !== 200) {
      console.error('Public forwards failed', r.status, r.body);
      process.exit(1);
    }
    console.log(`✓ Public forwards (${r.body.items?.length ?? 0} item(s), hasMore=${r.body.hasMore})`);
  } else {
    console.log('○ Skipping public API (set OC_API_KEY to test Bearer endpoints)');
  }

  console.log('\nOpportunity Circle integration smoke test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
