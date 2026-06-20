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

export function getPostUrl(post: BlogPost): string {
  return `/blog/${post.data.slug}/`;
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
  const index = posts.findIndex((post) => post.data.slug === current.data.slug);

  return {
    previous: index >= 0 ? posts[index + 1] : undefined,
    next: index > 0 ? posts[index - 1] : undefined,
  };
}

function assertUniqueSlugs(posts: BlogPost[]): void {
  const seen = new Map<string, string>();

  for (const post of posts) {
    const existing = seen.get(post.data.slug);
    if (existing) {
      throw new Error(`Duplicate blog slug "${post.data.slug}" in ${existing} and ${post.id}`);
    }

    seen.set(post.data.slug, post.id);
  }
}
