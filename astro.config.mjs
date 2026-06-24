// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

const imageExtensions = [
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jfif',
  'jpg',
  'jpeg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
];

/**
 * @param {string} value
 */
function extractImageUrl(value) {
  const trimmed = value.trim();
  const markdownImage = trimmed.match(/^!\[[^\]]*]\(([^)]+)\)$/);
  const candidate = markdownImage ? markdownImage[1].trim() : trimmed;

  try {
    const url = new URL(candidate);
    const pathname = url.pathname.toLowerCase();
    const extension = pathname.split('.').pop();
    const hasImageExtension = imageExtensions.includes(extension || '');
    const isLoven7Image = url.hostname === 'img.loven7.com' && pathname.startsWith('/file/');

    return /^https?:$/.test(url.protocol) && (hasImageExtension || isLoven7Image)
      ? url.toString()
      : null;
  } catch (error) {
    return null;
  }
}

function remarkImageUrls() {
  /** @param {any} tree */
  return (tree) => {
    /** @param {any} node */
    function walk(node) {
      if (!node || !Array.isArray(node.children)) return;

      node.children = node.children.map(/** @param {any} child */ (child) => {
        const singleChild = child.type === 'paragraph' && child.children?.length === 1
          ? child.children[0]
          : null;
        const imageUrl = singleChild?.type === 'text'
          ? extractImageUrl(singleChild.value)
          : singleChild?.type === 'link'
            ? extractImageUrl(singleChild.url)
            : null;

        if (imageUrl) {
          return {
            type: 'paragraph',
            children: [
              {
                type: 'image',
                url: imageUrl,
                alt: '图片',
              },
            ],
          };
        }

        walk(child);
        return child;
      });
    }

    walk(tree);
  };
}

function rehypeImageLinks() {
  /** @param {any} tree */
  return (tree) => {
    /** @param {any} node */
    function walk(node) {
      if (!node || !Array.isArray(node.children)) return;

      node.children = node.children.map(/** @param {any} child */ (child) => {
        const singleChild = child.type === 'element'
          && child.tagName === 'p'
          && child.children?.length === 1
          ? child.children[0]
          : null;
        const href = singleChild?.type === 'element' && singleChild.tagName === 'a'
          ? singleChild.properties?.href
          : null;
        const imageUrl = typeof href === 'string' ? extractImageUrl(href) : null;

        if (imageUrl) {
          return {
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'img',
                properties: {
                  src: imageUrl,
                  alt: '图片',
                  loading: 'lazy',
                  decoding: 'async',
                },
                children: [],
              },
            ],
          };
        }

        walk(child);
        return child;
      });
    }

    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.loven7.com',
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkImageUrls],
      rehypePlugins: [rehypeImageLinks],
    }),
  },
});
