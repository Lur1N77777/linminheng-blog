import {
  COUNT_KEY,
  ensureD1LocationSchema,
  getLocationKey,
  getRequestLocation,
  recordD1Location,
  recordKvLocation,
} from '../_shared/visitor-geo.js';

const DEFAULT_SALT = 'linminheng-blog-visitors';

function noStoreJson(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function getClientIp(request) {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  return headers.get('cf-connecting-ip')
    || headers.get('true-client-ip')
    || forwarded
    || 'unknown';
}

function getUserAgent(request) {
  return (request.headers.get('user-agent') || '').slice(0, 240);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashVisitor(ip, salt) {
  const input = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', input);

  return toHex(digest);
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS visitor_uniques (
        visitor_hash TEXT PRIMARY KEY,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        visits INTEGER NOT NULL DEFAULT 1,
        user_agent TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS visitor_stats (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      )
    `),
    db.prepare(`
      INSERT OR IGNORE INTO visitor_stats (key, value)
      VALUES ('unique_visitors', 0)
    `),
  ]);

  await ensureD1LocationSchema(db);
}

async function readCount(db) {
  const row = await db
    .prepare("SELECT value FROM visitor_stats WHERE key = 'unique_visitors'")
    .first();

  return Number(row?.value || 0);
}

async function handleKvVisitors({ kv, visitorHash, now, userAgent, location }) {
  const visitorKey = `visitor:${visitorHash}`;
  const existing = await kv.get(visitorKey, 'json');
  const isNewVisitor = !existing;
  const countLocationVisitor = !existing?.locationKey;
  const locationKey = await recordKvLocation({
    kv,
    location,
    now,
    countUniqueVisitor: countLocationVisitor,
  });

  if (isNewVisitor) {
    await kv.put(visitorKey, JSON.stringify({
      firstSeen: now,
      lastSeen: now,
      visits: 1,
      userAgent,
      location,
      locationKey,
    }));

    const currentCount = Number(await kv.get(COUNT_KEY) || 0);
    const nextCount = currentCount + 1;
    await kv.put(COUNT_KEY, String(nextCount));

    return {
      counted: true,
      count: nextCount,
      storage: 'kv',
    };
  }

  await kv.put(visitorKey, JSON.stringify({
    firstSeen: existing.firstSeen || now,
    lastSeen: now,
    visits: Number(existing.visits || 0) + 1,
    userAgent,
    location: existing.location || location,
    lastLocation: location,
    locationKey: existing.locationKey || locationKey,
  }));

  return {
    counted: false,
    count: Number(await kv.get(COUNT_KEY) || 0),
    storage: 'kv',
  };
}

async function handleD1Visitors({ db, visitorHash, now, userAgent, location }) {
  await ensureSchema(db);
  const locationKey = getLocationKey(location);
  const existing = await db
    .prepare('SELECT location_key FROM visitor_uniques WHERE visitor_hash = ?')
    .bind(visitorHash)
    .first();

  const inserted = await db
    .prepare(`
      INSERT OR IGNORE INTO visitor_uniques (
        visitor_hash, first_seen, last_seen, visits, user_agent,
        country, region, city, colo, timezone, location_key
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      visitorHash,
      now,
      now,
      userAgent,
      location.country,
      location.region,
      location.city,
      location.colo,
      location.timezone,
      locationKey,
    )
    .run();

  const isNewVisitor = Number(inserted.meta?.changes || 0) > 0;
  const countLocationVisitor = isNewVisitor || !existing?.location_key;
  await recordD1Location({ db, location, now, countUniqueVisitor: countLocationVisitor });

  if (isNewVisitor) {
    await db
      .prepare(`
        INSERT INTO visitor_stats (key, value)
        VALUES ('unique_visitors', 1)
        ON CONFLICT(key) DO UPDATE SET value = value + 1
      `)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE visitor_uniques
        SET
          last_seen = ?,
          visits = visits + 1,
          user_agent = ?,
          country = COALESCE(country, ?),
          region = COALESCE(region, ?),
          city = COALESCE(city, ?),
          colo = COALESCE(colo, ?),
          timezone = COALESCE(timezone, ?),
          location_key = COALESCE(location_key, ?)
        WHERE visitor_hash = ?
      `)
      .bind(
        now,
        userAgent,
        location.country,
        location.region,
        location.city,
        location.colo,
        location.timezone,
        locationKey,
        visitorHash,
      )
      .run();
  }

  return {
    counted: isNewVisitor,
    count: await readCount(db),
    storage: 'd1',
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.VISITOR_KV && !env.VISITOR_DB) {
    return noStoreJson({ ok: false, configured: false, count: null });
  }

  const now = new Date().toISOString();
  const visitorHash = await hashVisitor(getClientIp(request), env.VISITOR_SALT || DEFAULT_SALT);
  const userAgent = getUserAgent(request);
  const location = getRequestLocation(request);

  try {
    const result = env.VISITOR_KV
      ? await handleKvVisitors({ kv: env.VISITOR_KV, visitorHash, now, userAgent, location })
      : await handleD1Visitors({ db: env.VISITOR_DB, visitorHash, now, userAgent, location });

    return noStoreJson({
      ok: true,
      configured: true,
      counted: result.counted,
      count: result.count,
      storage: result.storage,
    });
  } catch {
    return noStoreJson({
      ok: false,
      configured: true,
      error: 'visitor_storage_unavailable',
      count: null,
    }, { status: 503 });
  }
}
