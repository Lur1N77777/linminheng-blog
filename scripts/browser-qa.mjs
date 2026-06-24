import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function readFrontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.+?))\\s*$`, 'm'));
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';

  return value.trim();
}

function getPublishedBlogPosts() {
  const directory = join(process.cwd(), 'src', 'content', 'blog');

  return readdirSync(directory)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(directory, file), 'utf8');
      const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';

      return {
        file,
        title: readFrontmatterValue(frontmatter, 'title'),
        slug: readFrontmatterValue(frontmatter, 'slug'),
        draft: /^draft:\s*true\s*$/m.test(frontmatter),
      };
    })
    .filter((post) => post.slug && !post.draft);
}

function getOpenPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate a port'));
      });
    });
  });
}

function findChromeExecutable() {
  const envPath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const candidates = [
    envPath,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

async function waitForServer(baseUrl, timeoutMs = 20_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch (error) {
      // Preview is still starting.
    }

    await delay(300);
  }

  throw new Error(`Preview server did not start within ${timeoutMs}ms`);
}

function stopProcessTree(child) {
  if (!child || child.killed) return;

  if (platform() === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  child.kill('SIGTERM');
}

function ignoreConsoleError(text) {
  return /favicon\.ico/i.test(text);
}

async function collectPageMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
    const outside = Array.from(document.querySelectorAll('body *'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          className: String(el.className || '').slice(0, 80),
          left: Math.floor(rect.left),
          right: Math.ceil(rect.right),
          width: Math.ceil(rect.width),
        };
      })
      .filter((rect) => rect.width > 0 && (rect.left < -2 || rect.right > window.innerWidth + 2))
      .slice(0, 8);
    const missingAltImages = Array.from(document.querySelectorAll('img'))
      .filter((image) =>
        !image.hasAttribute('alt')
        && image.getAttribute('role') !== 'presentation'
        && image.getAttribute('aria-hidden') !== 'true')
      .map((image) => image.getAttribute('src') || '(inline image)')
      .slice(0, 8);
    const unnamedButtons = Array.from(document.querySelectorAll('button'))
      .filter((button) =>
        !button.textContent?.trim()
        && !button.getAttribute('aria-label')?.trim()
        && !button.getAttribute('title')?.trim())
      .map((button) => button.outerHTML.slice(0, 120))
      .slice(0, 8);

    return {
      title: document.title,
      overflowX,
      hasMain: Boolean(document.querySelector('main')),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') || '',
      rssHref: document.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href') || '',
      manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
      appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '',
      skipTargetExists: Boolean(document.querySelector('.skip-link[href="#main-content"]') && document.getElementById('main-content')),
      jsonLdCount: document.querySelectorAll('script[type="application/ld+json"]').length,
      outside,
      missingAltImages,
      unnamedButtons,
    };
  });
}

async function main() {
  const posts = getPublishedBlogPosts();
  if (!posts.length) {
    throw new Error('Browser QA requires at least one published blog post');
  }
  const primaryPost = posts[0];
  const routes = ['/', '/blog/', `/blog/${primaryPost.slug}/`, '/admin/'];

  const cmsAsset = join(process.cwd(), 'public', 'vendor', 'sveltia-cms-0.167.3.js');
  if (!existsSync(cmsAsset)) {
    throw new Error(`Missing self-hosted CMS asset: ${cmsAsset}`);
  }
  const cloudmailLogo = join(process.cwd(), 'public', 'assets', 'cloudmail-logo.png');
  if (!existsSync(cloudmailLogo) || statSync(cloudmailLogo).size > 200_000) {
    throw new Error('CloudMail logo must exist and stay below 200KB');
  }

  const distCmsAsset = join(process.cwd(), 'dist', 'vendor', 'sveltia-cms-0.167.3.js');
  if (!existsSync(distCmsAsset)) {
    const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');
    const build = spawnSync(process.execPath, [astroCli, 'build'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
    });
    if (build.status !== 0) {
      throw new Error('Build failed before browser QA');
    }
  }

  const port = await getOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');
  const preview = spawn(process.execPath, [
    astroCli,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
  ], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let browser;
  const failures = [];

  try {
    await waitForServer(baseUrl);
    const cmsAssetResponse = await fetch(`${baseUrl}/vendor/sveltia-cms-0.167.3.js`);
    const cmsAssetText = await cmsAssetResponse.text();
    if (!cmsAssetResponse.ok || !cmsAssetText.includes('window.CMS')) {
      failures.push('cms asset: self-hosted Sveltia CMS file is not served correctly');
    }
    const seoChecks = [
      ['/robots.txt', ['Sitemap: https://blog.loven7.com/sitemap.xml', 'Disallow: /admin/']],
      ['/sitemap.xml', ['https://blog.loven7.com/', `https://blog.loven7.com/blog/${primaryPost.slug}/`]],
      ['/rss.xml', ['<rss version="2.0">', '<title>LinMinheng 的博文</title>', primaryPost.title]],
      ['/site.webmanifest', ['"name": "LinMinheng — 一方天地"', '"src": "/assets/icon-512.png"']],
    ];
    for (const [route, expectedParts] of seoChecks) {
      const response = await fetch(`${baseUrl}${route}`);
      const text = await response.text();
      if (!response.ok) {
        failures.push(`${route}: HTTP ${response.status}`);
        continue;
      }
      for (const part of expectedParts) {
        if (!text.includes(part)) failures.push(`${route}: missing ${part}`);
      }
    }

    const executablePath = findChromeExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport });
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', (message) => {
          if (message.type() === 'error' && !ignoreConsoleError(message.text())) {
            consoleErrors.push(message.text());
          }
        });
        page.on('pageerror', (error) => {
          pageErrors.push(error.message);
        });

        const response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        const metrics = await collectPageMetrics(page);
        await page.close();

        if (!response?.ok()) {
          failures.push(`${viewport.name} ${route}: HTTP ${response?.status()}`);
        }
        if (!metrics.hasMain) {
          failures.push(`${viewport.name} ${route}: missing <main>`);
        }
        if (!metrics.canonical) {
          failures.push(`${viewport.name} ${route}: missing canonical URL`);
        }
        if (!metrics.description) {
          failures.push(`${viewport.name} ${route}: missing meta description`);
        }
        if (route === '/admin/') {
          if (metrics.robots !== 'noindex, nofollow') {
            failures.push(`${viewport.name} ${route}: admin page must be noindex`);
          }
        } else {
          if (metrics.robots !== 'index, follow') {
            failures.push(`${viewport.name} ${route}: public page must be indexable`);
          }
          if (!metrics.rssHref) {
            failures.push(`${viewport.name} ${route}: missing RSS alternate link`);
          }
          if (metrics.manifestHref !== '/site.webmanifest') {
            failures.push(`${viewport.name} ${route}: missing manifest link`);
          }
          if (metrics.appleTouchIcon !== '/assets/apple-touch-icon.png') {
            failures.push(`${viewport.name} ${route}: missing apple touch icon`);
          }
          if (!metrics.ogImage.includes('/assets/social-card.png') && !metrics.ogImage) {
            failures.push(`${viewport.name} ${route}: missing Open Graph image`);
          }
          if (!metrics.twitterImage) {
            failures.push(`${viewport.name} ${route}: missing Twitter image`);
          }
          if (!metrics.skipTargetExists) {
            failures.push(`${viewport.name} ${route}: missing skip link target`);
          }
          if (metrics.jsonLdCount < 1) {
            failures.push(`${viewport.name} ${route}: missing JSON-LD structured data`);
          }
        }
        if (metrics.overflowX > 1 || metrics.outside.length > 0) {
          failures.push(`${viewport.name} ${route}: horizontal overflow ${metrics.overflowX}px ${JSON.stringify(metrics.outside)}`);
        }
        if (metrics.missingAltImages.length) {
          failures.push(`${viewport.name} ${route}: images missing alt ${JSON.stringify(metrics.missingAltImages)}`);
        }
        if (metrics.unnamedButtons.length) {
          failures.push(`${viewport.name} ${route}: buttons missing accessible names ${JSON.stringify(metrics.unnamedButtons)}`);
        }
        if (consoleErrors.length) {
          failures.push(`${viewport.name} ${route}: console errors ${JSON.stringify(consoleErrors)}`);
        }
        if (pageErrors.length) {
          failures.push(`${viewport.name} ${route}: page errors ${JSON.stringify(pageErrors)}`);
        }

        console.log(`OK ${viewport.name} ${route} ${metrics.title}`);
      }
    }

    const missing = await browser.newPage({ viewport: viewports[1] });
    const missingResponse = await missing.goto(`${baseUrl}/missing-page-for-qa/`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    const missingMetrics = await collectPageMetrics(missing);
    if (missingResponse?.status() !== 404) {
      failures.push(`404 mobile: expected HTTP 404, got ${missingResponse?.status()}`);
    }
    if (!missingMetrics.title.includes('页面没有找到')) {
      failures.push('404 mobile: custom not-found title did not render');
    }
    if (missingMetrics.robots !== 'noindex, nofollow') {
      failures.push('404 mobile: not-found page must be noindex');
    }
    if (missingMetrics.overflowX > 1 || missingMetrics.outside.length > 0) {
      failures.push(`404 mobile: horizontal overflow ${missingMetrics.overflowX}px ${JSON.stringify(missingMetrics.outside)}`);
    }
    await missing.close();

    const home = await browser.newPage({ viewport: viewports[1] });
    await home.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await home.click('#paletteTrigger');
    if ((await home.locator('#palette.open').count()) !== 1) {
      failures.push('home mobile: palette did not open');
    }
    await home.click('.swatch[data-p="openai"]');
    if ((await home.evaluate(() => document.documentElement.getAttribute('data-palette'))) !== 'openai') {
      failures.push('home mobile: palette switch failed');
    }
    await home.click('#themeToggle');
    if (!['dark', 'light'].includes(await home.evaluate(() => document.documentElement.getAttribute('data-theme')))) {
      failures.push('home mobile: theme switch failed');
    }
    await home.close();

    const blog = await browser.newPage({ viewport: viewports[1] });
    await blog.goto(`${baseUrl}/blog/`, { waitUntil: 'networkidle' });
    await blog.fill('[data-post-search]', primaryPost.title);
    await blog.waitForTimeout(200);
    const matchingVisiblePost = await blog.locator(`[data-post-item]:visible a[href="/blog/${primaryPost.slug}/"]`).count();
    if (matchingVisiblePost !== 1) {
      failures.push(`blog mobile: search did not reveal published post ${primaryPost.slug}`);
    }
    await blog.close();

    const admin = await browser.newPage({ viewport: viewports[1] });
    await admin.route('**/vendor/sveltia-cms-0.167.3.js*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.__sveltiaCmsPasswordQaLoaded = true;',
      });
    });
    await admin.goto(`${baseUrl}/admin/`, { waitUntil: 'networkidle' });
    await admin.fill('[data-password]', 'wrong-password');
    await admin.click('[data-submit]');
    await admin.waitForTimeout(300);
    const status = await admin.locator('[data-status]').textContent();
    if (!status?.includes('密码不对')) {
      failures.push('admin mobile: wrong password status did not render');
    }
    await admin.fill('[data-password]', 'lmh20030805');
    await admin.click('[data-submit]');
    await admin.waitForSelector('body.cms-ready', { timeout: 5_000 });
    if (!(await admin.evaluate(() => Boolean(window.__sveltiaCmsPasswordQaLoaded)))) {
      failures.push('admin mobile: documented password did not load CMS');
    }
    await admin.close();

    const adminUnlocked = await browser.newPage({ viewport: viewports[1] });
    const adminConsoleErrors = [];
    const adminPageErrors = [];
    adminUnlocked.on('console', (message) => {
      if (message.type() === 'error' && !ignoreConsoleError(message.text())) {
        adminConsoleErrors.push(message.text());
      }
    });
    adminUnlocked.on('pageerror', (error) => {
      adminPageErrors.push(error.message);
    });
    await adminUnlocked.route('**/vendor/sveltia-cms-0.167.3.js*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.__sveltiaCmsQaLoaded = true;',
      });
    });
    await adminUnlocked.addInitScript(() => {
      sessionStorage.setItem('yftd-admin-unlocked', '1');
    });
    await adminUnlocked.goto(`${baseUrl}/admin/`, { waitUntil: 'networkidle' });
    await adminUnlocked.waitForSelector('body.cms-ready', { timeout: 5_000 });
    const unlockedMetrics = await collectPageMetrics(adminUnlocked);
    if (unlockedMetrics.overflowX > 1 || unlockedMetrics.outside.length > 0) {
      failures.push(`admin unlocked mobile: horizontal overflow ${unlockedMetrics.overflowX}px ${JSON.stringify(unlockedMetrics.outside)}`);
    }
    if (unlockedMetrics.missingAltImages.length) {
      failures.push(`admin unlocked mobile: images missing alt ${JSON.stringify(unlockedMetrics.missingAltImages)}`);
    }
    if (unlockedMetrics.unnamedButtons.length) {
      failures.push(`admin unlocked mobile: buttons missing accessible names ${JSON.stringify(unlockedMetrics.unnamedButtons)}`);
    }
    if (adminConsoleErrors.length) {
      failures.push(`admin unlocked mobile: console errors ${JSON.stringify(adminConsoleErrors)}`);
    }
    if (adminPageErrors.length) {
      failures.push(`admin unlocked mobile: page errors ${JSON.stringify(adminPageErrors)}`);
    }

    const pasteResults = await adminUnlocked.evaluate(async () => {
      const imageUrl = 'https://img.loven7.com/file/qa-image.png';
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const textareaData = new DataTransfer();
      textareaData.setData('text/plain', imageUrl);
      textarea.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: textareaData,
      }));

      const editor = document.createElement('div');
      editor.contentEditable = 'true';
      editor.style.minHeight = '24px';
      document.body.appendChild(editor);
      editor.focus();

      const editorData = new DataTransfer();
      editorData.setData('text/plain', imageUrl);
      editor.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: editorData,
      }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      return {
        textareaValue: textarea.value,
        editorImageSrc: editor.querySelector('img')?.getAttribute('src') || '',
      };
    });
    if (!pasteResults.textareaValue.includes('![图片](https://img.loven7.com/file/qa-image.png)')) {
      failures.push('admin unlocked mobile: textarea image paste did not insert markdown');
    }
    if (pasteResults.editorImageSrc !== 'https://img.loven7.com/file/qa-image.png') {
      failures.push('admin unlocked mobile: contenteditable image paste did not insert image');
    }
    console.log('OK mobile /admin/ unlocked CMS mock and image paste');
    await adminUnlocked.close();
  } finally {
    await browser?.close();
    stopProcessTree(preview);
  }

  if (failures.length) {
    console.error('\nBrowser QA failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nBrowser QA passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
