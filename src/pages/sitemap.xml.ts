import type { APIRoute } from 'astro';
import { getPostUrl, getPublishedPosts } from '../utils/posts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ?? new URL('https://blog.loven7.com');
  const posts = await getPublishedPosts();
  const now = toDate(new Date());
  const urls = [
    { loc: '/', lastmod: now, priority: '1.0' },
    { loc: '/blog/', lastmod: now, priority: '0.8' },
    ...posts.map((post) => ({
      loc: getPostUrl(post),
      lastmod: toDate(post.data.updated ?? post.data.date),
      priority: '0.7',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `  <url>
    <loc>${escapeXml(new URL(item.loc, siteUrl).toString())}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  });
};
