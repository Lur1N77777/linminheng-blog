import { onRequestGet as authGet } from '../functions/api/auth.js';
import { onRequestPost as deviceStartPost } from '../functions/api/device-start.js';
import { onRequestPost as deviceTokenPost } from '../functions/api/device-token.js';
import { onRequestGet as visitorReportGet } from '../functions/api/visitor-report.js';
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

function createMemoryKv() {
  const store = new Map();

  return {
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
  };
}

function withCf(request, cf) {
  Object.defineProperty(request, 'cf', { value: cf });

  return request;
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

const geoKv = createMemoryKv();
const geoEnv = { VISITOR_KV: geoKv, VISITOR_SALT: 'qa-salt' };
const firstGeoVisit = await visitorsGet({
  env: geoEnv,
  request: withCf(new Request('https://blog.loven7.com/api/visitors', {
    headers: {
      'cf-connecting-ip': '203.0.113.20',
      'user-agent': 'Geo QA Browser',
    },
  }), {
    country: 'US',
    region: 'California',
    city: 'San Francisco',
    colo: 'SFO',
    timezone: 'America/Los_Angeles',
  }),
});
const firstGeoJson = await readJson(firstGeoVisit);
assert(firstGeoJson?.counted === true, 'First geo visit should be counted as a unique visitor');

const secondGeoVisit = await visitorsGet({
  env: geoEnv,
  request: withCf(new Request('https://blog.loven7.com/api/visitors', {
    headers: {
      'cf-connecting-ip': '203.0.113.20',
      'user-agent': 'Geo QA Browser',
    },
  }), {
    country: 'US',
    region: 'California',
    city: 'San Francisco',
    colo: 'SFO',
    timezone: 'America/Los_Angeles',
  }),
});
const secondGeoJson = await readJson(secondGeoVisit);
assert(secondGeoJson?.counted === false, 'Repeat geo visit should not create another unique visitor');
assert(secondGeoJson?.count === 1, 'Repeat geo visit should keep unique visitor count at 1');

const disabledReport = await visitorReportGet({
  env: geoEnv,
  request: new Request('https://blog.loven7.com/api/visitor-report?token=report-token'),
});
assert(disabledReport.status === 404, 'Visitor report should be disabled until a report token is configured');

const unauthorizedReport = await visitorReportGet({
  env: { ...geoEnv, VISITOR_REPORT_TOKEN: 'report-token' },
  request: new Request('https://blog.loven7.com/api/visitor-report?token=wrong-token'),
});
assert(unauthorizedReport.status === 401, 'Visitor report should reject a wrong token');

const authorizedReport = await visitorReportGet({
  env: { ...geoEnv, VISITOR_REPORT_TOKEN: 'report-token' },
  request: new Request('https://blog.loven7.com/api/visitor-report', {
    headers: { authorization: 'Bearer report-token' },
  }),
});
const authorizedReportJson = await readJson(authorizedReport);
assert(authorizedReport.status === 200, 'Visitor report should return 200 with a valid token');
assert(authorizedReportJson?.uniqueVisitors === 1, 'Visitor report should include total unique visitors');
assert(authorizedReportJson?.locations?.[0]?.country === 'US', 'Visitor report should include country aggregation');
assert(authorizedReportJson?.locations?.[0]?.city === 'San Francisco', 'Visitor report should include city aggregation');
assert(authorizedReportJson?.locations?.[0]?.uniqueVisitors === 1, 'Visitor report should count unique visitors by location once');
assert(authorizedReportJson?.locations?.[0]?.visits === 2, 'Visitor report should count repeat visits by location');
assert(!JSON.stringify(authorizedReportJson).includes('203.0.113.20'), 'Visitor report must not expose raw IP addresses');

if (failures.length) {
  console.error('Functions QA failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Functions QA passed.');
}
