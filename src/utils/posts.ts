import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export type PostNav = {
  previous?: BlogPost;
  next?: BlogPost;
};

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  assertUniqueSlugs(posts);

  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getPostSlug(post: BlogPost): string {
  const explicitSlug = normalizeSlug(post.data.slug ?? '');
  if (explicitSlug) return explicitSlug;

  const filename = post.id.replace(/\\/g, '/').split('/').pop() ?? post.id;
  const withoutExtension = filename.replace(/\.mdx?$/i, '');
  const withoutDate = withoutExtension.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const fileSlug = normalizeSlug(withoutDate) || normalizeSlug(withoutExtension);

  return fileSlug || `post-${hashString(post.id)}`;
}

export function getPostUrl(post: BlogPost): string {
  return `/blog/${getPostSlug(post)}/`;
}

export function formatPostDate(value: Date): string {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y} · ${m} · ${day}`;
}

export function getReadingTime(post: BlogPost): string {
  const body = post.body ?? '';
  const words = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]()!-]/g, ' ')
    .trim();
  const latinWords = words.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const cjkChars = words.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const minutes = Math.max(1, Math.ceil((latinWords + cjkChars / 2) / 220));

  return `${minutes} 分钟读完`;
}

export function getAdjacentPosts(posts: BlogPost[], current: BlogPost): PostNav {
  const currentSlug = getPostSlug(current);
  const index = posts.findIndex((post) => getPostSlug(post) === currentSlug);

  return {
    previous: index >= 0 ? posts[index + 1] : undefined,
    next: index > 0 ? posts[index - 1] : undefined,
  };
}

function assertUniqueSlugs(posts: BlogPost[]): void {
  const seen = new Map<string, string>();

  for (const post of posts) {
    const slug = getPostSlug(post);
    const existing = seen.get(slug);
    if (existing) {
      throw new Error(`Duplicate blog slug "${slug}" in ${existing} and ${post.id}`);
    }

    seen.set(slug, post.id);
  }
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return Math.abs(hash).toString(36);
}
