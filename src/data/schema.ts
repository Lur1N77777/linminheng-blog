import { z } from 'zod';

const paletteSchema = z.enum([
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
]);

const themeSchema = z.enum(['dark', 'light']);

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

export const profileContentSchema = z.object({
  profile: z.object({
    name: nonEmptyString,
    title: nonEmptyString,
    tagline: optionalText,
    foot: optionalText,
    defaultPalette: paletteSchema,
    defaultTheme: themeSchema,
    socials: z.object({
      github: optionalUrl,
      instagram: optionalUrl,
      email: optionalEmail,
    }).strict(),
  }).strict(),
  about: z.array(nonEmptyString).default([]),
}).strict();

export const projectsContentSchema = z.object({
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
}).strict();

export const sitesContentSchema = z.object({
  sites: z.array(z.object({
    name: nonEmptyString,
    href: z.url(),
    desc: nonEmptyString,
    logo: logoPath,
    tags: tagsSchema,
  }).strict()).default([]),
}).strict();

export const experiencesContentSchema = z.object({
  experiences: z.array(z.object({
    meta: nonEmptyString,
    title: nonEmptyString,
    desc: nonEmptyString,
    href: optionalUrl.optional(),
    tags: tagsSchema,
  }).strict()).default([]),
}).strict();

export type Palette = z.infer<typeof paletteSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Profile = z.infer<typeof profileContentSchema>['profile'];
export type Socials = Profile['socials'];
export type Project = z.infer<typeof projectsContentSchema>['projects'][number];
export type Site = z.infer<typeof sitesContentSchema>['sites'][number];
export type Experience = z.infer<typeof experiencesContentSchema>['experiences'][number];
