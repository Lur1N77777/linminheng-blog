import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string(),
    date: z.coerce.date(),
    updated: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.date().optional(),
    ),
    excerpt: z.string(),
    tags: z.array(z.string()).default([]),
    foot: z.string().optional(),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
