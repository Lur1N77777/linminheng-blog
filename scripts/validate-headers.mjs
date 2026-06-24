import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const headersPath = join(process.cwd(), 'public', '_headers');
const raw = await readFile(headersPath, 'utf8');

function parseHeadersFile(value) {
  const blocks = new Map();
  let currentPath = null;

  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;

    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      currentPath = line.trim();
      blocks.set(currentPath, new Map());
      continue;
    }

    if (!currentPath) continue;

    const trimmed = line.trim();
    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;

    blocks.get(currentPath).set(
      trimmed.slice(0, separator).toLowerCase(),
      trimmed.slice(separator + 1).trim(),
    );
  }

  return blocks;
}

function assertHeader(blocks, path, name, expectedValue) {
  const headers = blocks.get(path);
  const actualValue = headers?.get(name.toLowerCase());

  if (actualValue !== expectedValue) {
    failures.push(`${path}: expected ${name}: ${expectedValue}, got ${actualValue || '(missing)'}`);
  }
}

const blocks = parseHeadersFile(raw);
const failures = [];

const requiredBlocks = ['/*', '/', '/blog/*', '/admin/*', '/api/*', '/*.html', '/*.xml', '/robots.txt', '/*.webmanifest', '/_astro/*', '/vendor/*', '/assets/*'];
for (const block of requiredBlocks) {
  if (!blocks.has(block)) {
    failures.push(`Missing _headers block: ${block}`);
  }
}

assertHeader(blocks, '/*', 'X-Content-Type-Options', 'nosniff');
assertHeader(
  blocks,
  '/*',
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.github.com https://github.com https://unpkg.com https://cloudflareinsights.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
);
assertHeader(blocks, '/*', 'X-Frame-Options', 'DENY');
assertHeader(blocks, '/*', 'Referrer-Policy', 'strict-origin-when-cross-origin');
assertHeader(blocks, '/*', 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
assertHeader(blocks, '/*', 'Strict-Transport-Security', 'max-age=31536000');

assertHeader(blocks, '/', 'Cache-Control', 'public, max-age=0, must-revalidate');
assertHeader(blocks, '/blog/*', 'Cache-Control', 'public, max-age=0, must-revalidate');
assertHeader(blocks, '/admin/*', 'Cache-Control', 'no-store');
assertHeader(blocks, '/api/*', 'Cache-Control', 'no-store');
assertHeader(blocks, '/*.html', 'Cache-Control', 'public, max-age=0, must-revalidate');
assertHeader(blocks, '/*.xml', 'Cache-Control', 'public, max-age=3600');
assertHeader(blocks, '/robots.txt', 'Cache-Control', 'public, max-age=3600');
assertHeader(blocks, '/*.webmanifest', 'Cache-Control', 'public, max-age=86400');
assertHeader(blocks, '/_astro/*', 'Cache-Control', 'public, max-age=31536000, immutable');
assertHeader(blocks, '/vendor/*', 'Cache-Control', 'public, max-age=31536000, immutable');
assertHeader(blocks, '/assets/*', 'Cache-Control', 'public, max-age=86400');

if (failures.length) {
  console.error('Headers validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Headers validation passed.');
}
