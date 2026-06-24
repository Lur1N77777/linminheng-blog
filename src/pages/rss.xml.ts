import type { APIRoute } from 'astro';
import { profile } from '../data/profile';
import { getPostUrl, getPublishedPosts } from '../utils/posts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ?? new URL('https://blog.loven7.com');
  const posts = await getPublishedPosts();
  const channelUrl = new URL('/blog/', siteUrl).toString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${profile.name} 的博文`)}</title>
    <link>${escapeXml(channelUrl)}</link>
    <description>${escapeXml('项目记录、日常想法和慢慢整理出来的文字。')}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((post) => {
  const postUrl = new URL(getPostUrl(post), siteUrl).toString();
  return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${post.data.date.toUTCString()}</pubDate>
      <description>${escapeXml(post.data.excerpt)}</description>
    </item>`;
}).join('\n')}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
    },
  });
};
