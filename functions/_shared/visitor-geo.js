export const COUNT_KEY = 'stats:unique_visitors';
export const LOCATION_INDEX_KEY = 'stats:locations:index';
export const LOCATION_ITEM_PREFIX = 'stats:locations:item:';

const UNKNOWN = 'Unknown';

function cleanPart(value, fallback = UNKNOWN) {
  const text = String(value || '').trim();

  return (text || fallback).slice(0, 80);
}

export function getRequestLocation(request) {
  const cf = request.cf || {};
  const countryHeader = request.headers.get('cf-ipcountry');

  return {
    country: cleanPart(cf.country || countryHeader),
    region: cleanPart(cf.region),
    city: cleanPart(cf.city),
    colo: cleanPart(cf.colo),
    timezone: cleanPart(cf.timezone),
  };
}

export function getLocationKey(location) {
  return [
    cleanPart(location.country),
    cleanPart(location.region),
    cleanPart(location.city),
  ].join('|');
}

function getLocationItemKey(locationKey) {
  return `${LOCATION_ITEM_PREFIX}${encodeURIComponent(locationKey)}`;
}

async function updateLocationIndex(kv, locationKey) {
  const existing = await kv.get(LOCATION_INDEX_KEY, 'json');
  const index = Array.isArray(existing) ? existing : [];

  if (!index.includes(locationKey)) {
    index.push(locationKey);
    index.sort();
    await kv.put(LOCATION_INDEX_KEY, JSON.stringify(index));
  }
}

export async function recordKvLocation({ kv, location, now, countUniqueVisitor }) {
  const locationKey = getLocationKey(location);
  const itemKey = getLocationItemKey(locationKey);
  const existing = await kv.get(itemKey, 'json');
  const next = {
    key: locationKey,
    country: cleanPart(location.country),
    region: cleanPart(location.region),
    city: cleanPart(location.city),
    colo: cleanPart(location.colo),
    timezone: cleanPart(location.timezone),
    visitors: Number(existing?.visitors || 0) + (countUniqueVisitor ? 1 : 0),
    visits: Number(existing?.visits || 0) + 1,
    lastSeen: now,
  };

  await kv.put(itemKey, JSON.stringify(next));
  await updateLocationIndex(kv, locationKey);

  return locationKey;
}

export async function readKvLocationReport(kv) {
  const index = await kv.get(LOCATION_INDEX_KEY, 'json');
  const keys = Array.isArray(index) ? index : [];
  const locations = [];

  for (const locationKey of keys) {
    const item = await kv.get(getLocationItemKey(locationKey), 'json');
    if (item) locations.push(item);
  }

  locations.sort((a, b) =>
    Number(b.visitors || 0) - Number(a.visitors || 0)
    || Number(b.visits || 0) - Number(a.visits || 0)
    || String(a.key || '').localeCompare(String(b.key || '')),
  );

  return locations;
}

export async function addColumnIfMissing(db, table, definition) {
  try {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
      throw error;
    }
  }
}

export async function ensureD1LocationSchema(db) {
  await addColumnIfMissing(db, 'visitor_uniques', 'country TEXT');
  await addColumnIfMissing(db, 'visitor_uniques', 'region TEXT');
  await addColumnIfMissing(db, 'visitor_uniques', 'city TEXT');
  await addColumnIfMissing(db, 'visitor_uniques', 'colo TEXT');
  await addColumnIfMissing(db, 'visitor_uniques', 'timezone TEXT');
  await addColumnIfMissing(db, 'visitor_uniques', 'location_key TEXT');

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS visitor_locations (
      location_key TEXT PRIMARY KEY,
      country TEXT NOT NULL,
      region TEXT,
      city TEXT,
      colo TEXT,
      timezone TEXT,
      visitors INTEGER NOT NULL DEFAULT 0,
      visits INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL
    )
  `).run();
}

export async function recordD1Location({ db, location, now, countUniqueVisitor }) {
  const locationKey = getLocationKey(location);

  await db
    .prepare(`
      INSERT INTO visitor_locations (
        location_key, country, region, city, colo, timezone, visitors, visits, last_seen
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(location_key) DO UPDATE SET
        visitors = visitors + ?,
        visits = visits + 1,
        last_seen = excluded.last_seen
    `)
    .bind(
      locationKey,
      cleanPart(location.country),
      cleanPart(location.region),
      cleanPart(location.city),
      cleanPart(location.colo),
      cleanPart(location.timezone),
      countUniqueVisitor ? 1 : 0,
      now,
      countUniqueVisitor ? 1 : 0,
    )
    .run();

  return locationKey;
}

export async function readD1LocationReport(db) {
  const result = await db
    .prepare(`
      SELECT location_key AS key, country, region, city, colo, timezone, visitors, visits, last_seen AS lastSeen
      FROM visitor_locations
      ORDER BY visitors DESC, visits DESC, location_key ASC
      LIMIT 100
    `)
    .all();

  return result.results || [];
}
