const DEFAULT_SALT = 'linminheng-blog-visitors';

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
}

async function readCount(db) {
  const row = await db
    .prepare("SELECT value FROM visitor_stats WHERE key = 'unique_visitors'")
    .first();

  return Number(row?.value || 0);
}

export async function onRequestGet({ env, request }) {
  if (!env.VISITOR_DB) {
    return Response.json(
      { ok: false, configured: false, count: null },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const db = env.VISITOR_DB;
  const now = new Date().toISOString();
  const visitorHash = await hashVisitor(getClientIp(request), env.VISITOR_SALT || DEFAULT_SALT);
  const userAgent = getUserAgent(request);

  await ensureSchema(db);

  const inserted = await db
    .prepare(`
      INSERT OR IGNORE INTO visitor_uniques (visitor_hash, first_seen, last_seen, visits, user_agent)
      VALUES (?, ?, ?, 1, ?)
    `)
    .bind(visitorHash, now, now, userAgent)
    .run();

  const isNewVisitor = Number(inserted.meta?.changes || 0) > 0;

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
        SET last_seen = ?, visits = visits + 1, user_agent = ?
        WHERE visitor_hash = ?
      `)
      .bind(now, userAgent, visitorHash)
      .run();
  }

  return Response.json(
    {
      ok: true,
      configured: true,
      counted: isNewVisitor,
      count: await readCount(db),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
