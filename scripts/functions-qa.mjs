import { onRequestGet as authGet } from '../functions/api/auth.js';
import { onRequestPost as deviceStartPost } from '../functions/api/device-start.js';
import { onRequestPost as deviceTokenPost } from '../functions/api/device-token.js';
import { onRequestGet as visitorsGet } from '../functions/api/visitors.js';

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    failures.push(`Expected JSON response: ${error.message}`);
    return null;
  }
}

async function withFetchMock(mock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const unsupportedAuth = await authGet({
  env: {},
  request: new Request('https://blog.loven7.com/api/auth?provider=gitlab'),
});
assert(unsupportedAuth.status === 400, 'Unsupported auth provider should return 400');

const authPage = await authGet({
  env: { GITHUB_CLIENT_ID: 'test-client-id', GITHUB_AUTH_SCOPE: 'public_repo' },
  request: new Request('https://blog.loven7.com/api/auth?provider=github'),
});
const authHtml = await authPage.text();
assert(authPage.status === 200, 'GitHub auth page should return 200');
assert(authHtml.includes('public_repo'), 'GitHub auth page should include configured scope');

let deviceStartRequestBody = null;
await withFetchMock(async (url, init = {}) => {
  assert(url === 'https://github.com/login/device/code', 'Device start should call GitHub device code endpoint');
  deviceStartRequestBody = JSON.parse(init.body);
  return Response.json({
    device_code: 'device-code',
    user_code: 'USER-CODE',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5,
  });
}, async () => {
  const deviceStart = await deviceStartPost({
    env: { GITHUB_CLIENT_ID: 'configured-client-id', GITHUB_AUTH_SCOPE: 'public_repo' },
    request: new Request('https://blog.loven7.com/api/device-start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'repo' }),
    }),
  });
  const deviceStartJson = await readJson(deviceStart);
  assert(deviceStart.status === 200, 'Device start should return 200');
  assert(deviceStart.headers.get('cache-control') === 'no-store', 'Device start should be no-store');
  assert(deviceStartJson?.device_code === 'device-code', 'Device start should return GitHub payload');
  assert(deviceStartRequestBody?.client_id === 'configured-client-id', 'Device start should use configured client id');
  assert(deviceStartRequestBody?.scope === 'public_repo', 'Device start should prefer configured scope');
});

await withFetchMock(async () => {
  throw new Error('network down');
}, async () => {
  const failedDeviceStart = await deviceStartPost({
    env: {},
    request: new Request('https://blog.loven7.com/api/device-start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  });
  const failedDeviceStartJson = await readJson(failedDeviceStart);
  assert(failedDeviceStart.status === 502, 'Device start network failure should return 502');
  assert(failedDeviceStartJson?.error === 'github_unreachable', 'Device start network failure should be explicit');
});

const missingDeviceCode = await deviceTokenPost({
  env: {},
  request: new Request('https://blog.loven7.com/api/device-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }),
});
const missingDeviceCodeJson = await readJson(missingDeviceCode);
assert(missingDeviceCode.status === 400, 'Missing device code should return 400');
assert(missingDeviceCode.headers.get('cache-control') === 'no-store', 'Missing device code should be no-store');
assert(missingDeviceCodeJson?.error === 'missing_device_code', 'Missing device code should return explicit error');

await withFetchMock(async () => new Response('not-json', { status: 502 }), async () => {
  const invalidDeviceToken = await deviceTokenPost({
    env: {},
    request: new Request('https://blog.loven7.com/api/device-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: 'device-code' }),
    }),
  });
  const invalidDeviceTokenJson = await readJson(invalidDeviceToken);
  assert(invalidDeviceToken.status === 502, 'Device token invalid GitHub response should return 502');
  assert(invalidDeviceTokenJson?.error === 'github_invalid_response', 'Device token invalid GitHub response should be explicit');
});

const unconfiguredVisitors = await visitorsGet({
  env: {},
  request: new Request('https://blog.loven7.com/api/visitors'),
});
const unconfiguredVisitorsJson = await readJson(unconfiguredVisitors);
assert(unconfiguredVisitors.status === 200, 'Unconfigured visitor stats should return 200');
assert(unconfiguredVisitorsJson?.configured === false, 'Unconfigured visitor stats should report configured=false');

const failedVisitors = await visitorsGet({
  env: {
    VISITOR_KV: {
      async get() {
        throw new Error('KV unavailable');
      },
    },
  },
  request: new Request('https://blog.loven7.com/api/visitors', {
    headers: { 'cf-connecting-ip': '203.0.113.10' },
  }),
});
const failedVisitorsJson = await readJson(failedVisitors);
assert(failedVisitors.status === 503, 'Visitor storage failure should return 503');
assert(failedVisitors.headers.get('cache-control') === 'no-store', 'Visitor storage failure should be no-store');
assert(failedVisitorsJson?.error === 'visitor_storage_unavailable', 'Visitor storage failure should be explicit');

if (failures.length) {
  console.error('Functions QA failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Functions QA passed.');
}
