// @ts-check
import { defineConfig } from 'astro/config';

const imageUrlPattern = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:[?#]\S*)?$/i;

function remarkImageUrls() {
  return (tree) => {
    function walk(node) {
      if (!node || !Array.isArray(node.children)) return;

      node.children = node.children.map((child) => {
        const imageUrl = child.type === 'paragraph'
          && child.children?.length === 1
          && child.children[0].type === 'text'
          && imageUrlPattern.test(child.children[0].value.trim())
          ? child.children[0].value.trim()
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

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.loven7.com',
  trailingSlash: 'ignore',
  markdown: {
    remarkPlugins: [remarkImageUrls],
  },
});
