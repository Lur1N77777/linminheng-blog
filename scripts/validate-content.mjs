import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const root = process.cwd();

const palettes = [
  'amber',
  'pine',
  'terra',
  'indigo',
  'heather',
  'ink',
  'stone',
  'olive',
  'onyx',
  'claude',
  'openai',
];

const nonEmptyString = z.string().trim().min(1);
const optionalText = z.string().default('');
const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === '' || z.email().safeParse(value).success, {
    message: 'Must be empty or a valid email address',
  })
  .default('');
const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === '' || z.url().safeParse(value).success, {
    message: 'Must be empty or a valid absolute URL',
  })
  .default('');
const logoPath = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === ''
      || value.startsWith('/assets/')
      || z.url().safeParse(value).success,
    {
      message: 'Logo must be empty, an /assets/ path, or an absolute URL',
    },
  )
  .default('');
const tagsSchema = z.array(nonEmptyString).default([]);
const repoSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value), {
    message: 'Repo must be empty or use owner/name format',
  })
  .default('');

const schemas = {
  'profile.json': z.object({
    profile: z.object({
      name: nonEmptyString,
      title: nonEmptyString,
      tagline: optionalText,
      foot: optionalText,
      defaultPalette: z.enum(palettes),
      defaultTheme: z.enum(['dark', 'light']),
      socials: z.object({
        github: optionalUrl,
        instagram: optionalUrl,
        email: optionalEmail,
      }).strict(),
    }).strict(),
    about: z.array(nonEmptyString).default([]),
  }).strict(),
  'projects.json': z.object({
    githubProfile: z.url(),
    projects: z.array(z.object({
      name: nonEmptyString,
      href: z.url(),
      repo: repoSchema,
      stars: z.number().int().nonnegative().default(0),
      desc: nonEmptyString,
      logo: logoPath,
      tags: tagsSchema,
    }).strict()).default([]),
  }).strict(),
  'sites.json': z.object({
    sites: z.array(z.object({
      name: nonEmptyString,
      href: z.url(),
      desc: nonEmptyString,
      logo: logoPath,
      tags: tagsSchema,
    }).strict()).default([]),
  }).strict(),
  'experiences.json': z.object({
    experiences: z.array(z.object({
      meta: nonEmptyString,
      title: nonEmptyString,
      desc: nonEmptyString,
      href: optionalUrl.optional(),
      tags: tagsSchema,
    }).strict()).default([]),
  }).strict(),
};

async function readJson(relativePath) {
  const absolutePath = join(root, relativePath);
  const raw = await readFile(absolutePath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON: ${error.message}`);
  }
}

function formatIssues(error) {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function getFrontmatter(raw, relativePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    throw new Error(`${relativePath}: missing frontmatter block`);
  }

  return match[1];
}

function readFrontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.+?))\\s*$`, 'm'));
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';

  return value.trim();
}

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return Math.abs(hash).toString(36);
}

function derivePostSlug(file, explicitSlug) {
  const normalizedExplicit = normalizeSlug(explicitSlug);
  if (normalizedExplicit) return normalizedExplicit;

  const withoutExtension = file.replace(/\.mdx?$/i, '');
  const withoutDate = withoutExtension.replace(/^\d{4}-\d{2}-\d{2}-/, '');

  return normalizeSlug(withoutDate) || normalizeSlug(withoutExtension) || `post-${hashString(file)}`;
}

async function validateBlogPosts() {
  const directory = 'src/content/blog';
  const files = (await readdir(join(root, directory))).filter((file) => file.endsWith('.md'));
  let publishedCount = 0;
  const seenSlugs = new Map();
  const issues = [];

  for (const file of files) {
    const relativePath = `${directory}/${file}`;
    const frontmatter = getFrontmatter(await readFile(join(root, relativePath), 'utf8'), relativePath);
    const slug = derivePostSlug(file, readFrontmatterValue(frontmatter, 'slug'));
    const isDraft = /^draft:\s*true\s*$/m.test(frontmatter);

    if (!isDraft) {
      const existing = seenSlugs.get(slug);
      if (existing) {
        issues.push(`${relativePath}: duplicate public slug "${slug}" also used by ${existing}`);
      }
      seenSlugs.set(slug, relativePath);
      publishedCount += 1;
    }
  }

  if (publishedCount === 0) {
    issues.push(`${directory}: at least one published post is required`);
  }

  return issues;
}

async function validateCmsConfig() {
  const relativePath = 'public/admin/config.yml';
  const raw = await readFile(join(root, relativePath), 'utf8');
  const issues = [];

  if (!raw.includes('label: 链接名（可选）') || !/name:\s*slug[\s\S]*?required:\s*false/.test(raw)) {
    issues.push(`${relativePath}: blog slug field must be optional so CMS saves are not blocked by URL formatting`);
  }

  if (/name:\s*slug[\s\S]*?pattern:/.test(raw)) {
    issues.push(`${relativePath}: blog slug field must not use a CMS pattern that blocks saving`);
  }

  if (!/name:\s*draft[^\n]*default:\s*false/.test(raw)) {
    issues.push(`${relativePath}: blog draft field must default to false so new CMS posts publish visibly`);
  }

  return issues;
}

let failed = false;

for (const [file, schema] of Object.entries(schemas)) {
  const relativePath = `src/data/content/${file}`;

  try {
    schema.parse(await readJson(relativePath));
    console.log(`OK ${relativePath}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${relativePath}`);
    console.error(error instanceof z.ZodError ? formatIssues(error) : `  - ${error.message}`);
  }
}

for (const issue of await validateBlogPosts()) {
  failed = true;
  console.error(`FAIL ${issue}`);
}

for (const issue of await validateCmsConfig()) {
  failed = true;
  console.error(`FAIL ${issue}`);
}

if (failed) {
  process.exitCode = 1;
}
