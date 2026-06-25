import {
  COUNT_KEY,
  readD1LocationReport,
  readKvLocationReport,
} from '../_shared/visitor-geo.js';

function noStoreJson(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || new URL(request.url).searchParams.get('token') || '';
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

function summarize(locations) {
  const totals = locations.reduce((acc, location) => {
    acc.uniqueVisitors += Number(location.visitors || 0);
    acc.visits += Number(location.visits || 0);
    return acc;
  }, { uniqueVisitors: 0, visits: 0 });

  return {
    totals,
    locations: locations.map((location) => ({
      country: location.country || 'Unknown',
      region: location.region || 'Unknown',
      city: location.city || 'Unknown',
      colo: location.colo || 'Unknown',
      timezone: location.timezone || 'Unknown',
      uniqueVisitors: Number(location.visitors || 0),
      visits: Number(location.visits || 0),
      lastSeen: location.lastSeen || location.last_seen || null,
    })),
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.VISITOR_REPORT_TOKEN) {
    return noStoreJson({ ok: false, configured: false }, { status: 404 });
  }

  if (!constantTimeEqual(getBearerToken(request), env.VISITOR_REPORT_TOKEN)) {
    return noStoreJson({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!env.VISITOR_KV && !env.VISITOR_DB) {
    return noStoreJson({ ok: false, configured: false, error: 'visitor_storage_not_configured' }, { status: 503 });
  }

  try {
    if (env.VISITOR_KV) {
      const locations = await readKvLocationReport(env.VISITOR_KV);
      const count = Number(await env.VISITOR_KV.get(COUNT_KEY) || 0);

      return noStoreJson({
        ok: true,
        configured: true,
        storage: 'kv',
        generatedAt: new Date().toISOString(),
        uniqueVisitors: count,
        ...summarize(locations),
      });
    }

    const locations = await readD1LocationReport(env.VISITOR_DB);

    return noStoreJson({
      ok: true,
      configured: true,
      storage: 'd1',
      generatedAt: new Date().toISOString(),
      ...summarize(locations),
    });
  } catch {
    return noStoreJson({
      ok: false,
      configured: true,
      error: 'visitor_report_unavailable',
    }, { status: 503 });
  }
}
