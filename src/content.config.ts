import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 博文集合:每篇博文是 src/content/blog/ 下的一个 .md 文件
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    tags: z.array(z.string()).default([]),
    // 可选:结尾的斜体小字(如「写于一个深夜」)
    foot: z.string().optional(),
  }),
});

export const collections = { blog };
