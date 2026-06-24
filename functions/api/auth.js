import { getGithubAuthScope } from '../_shared/github-oauth.js';

function page({ scope }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub 登录 · 一方天地</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #11100f;
        --panel: #181612;
        --line: rgba(244, 234, 220, 0.14);
        --text: #f4eadc;
        --muted: rgba(244, 234, 220, 0.68);
        --accent: #d9a860;
        --danger: #ffb0a6;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: var(--bg);
        color: var(--text);
      }

      main {
        width: min(100%, 480px);
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: none;
      }

      .head, .body { padding: 22px; }
      .head { border-bottom: 1px solid var(--line); }
      h1 { margin: 0; font-size: 24px; font-weight: 620; letter-spacing: 0; }
      p { color: var(--muted); line-height: 1.7; }
      .code {
        display: grid;
        place-items: center;
        min-height: 72px;
        margin: 16px 0;
        border: 1px solid rgba(217, 168, 96, 0.35);
        border-radius: 8px;
        background: rgba(217, 168, 96, 0.08);
        color: var(--accent);
        font-size: 30px;
        font-weight: 760;
        letter-spacing: 0.12em;
      }
      a, button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        border-radius: 8px;
        border: 1px solid rgba(217, 168, 96, 0.42);
        background: #d9a860;
        color: #17100a;
        padding: 0 16px;
        font: inherit;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
      }
      a:hover, button:hover {
        background: color-mix(in srgb, var(--accent) 88%, #11100f);
        border-color: var(--accent);
        transform: translateY(-1px);
      }
      .secondary {
        margin-left: 8px;
        background: transparent;
        color: var(--text);
      }
      .status { min-height: 1.6em; margin-bottom: 0; }
      .error { color: var(--danger); }
      [hidden] { display: none; }
    </style>
  </head>
  <body>
    <main>
      <section class="head">
        <h1>连接 GitHub</h1>
        <p>后台需要一次 GitHub 授权，授权后才能把文章和资料保存到仓库。</p>
      </section>
      <section class="body">
        <p data-loading>正在创建授权码...</p>
        <div data-auth hidden>
          <p>复制下面的授权码，然后打开 GitHub 完成确认。</p>
          <div class="code" data-code></div>
          <a data-link href="#" target="_blank" rel="noopener">打开 GitHub 授权页</a>
          <button class="secondary" data-copy type="button">复制授权码</button>
        </div>
        <p class="status" data-status aria-live="polite"></p>
      </section>
    </main>

    <script>
      const provider = 'github';
      const scope = ${JSON.stringify(scope)};
      const codeEl = document.querySelector('[data-code]');
      const linkEl = document.querySelector('[data-link]');
      const authEl = document.querySelector('[data-auth]');
      const loadingEl = document.querySelector('[data-loading]');
      const statusEl = document.querySelector('[data-status]');
      const copyButton = document.querySelector('[data-copy]');
      const authBridgeKey = 'sveltia-cms-auth-message:' + provider;
      let message = null;

      function setStatus(text, error = false) {
        statusEl.textContent = text;
        statusEl.classList.toggle('error', error);
      }

      function sendToCms() {
        if (!message) return;

        try {
          localStorage.setItem(authBridgeKey, JSON.stringify({ message, createdAt: Date.now() }));
        } catch (error) {}

        if (!window.opener) return;
        window.opener.postMessage('authorizing:' + provider, window.location.origin);
        window.opener.postMessage(message, window.location.origin);
      }

      window.addEventListener('message', (event) => {
        if (event.data === 'authorizing:' + provider && message && window.opener) {
          window.opener.postMessage(message, event.origin);
        }
      });

      function complete(token) {
        const payload = JSON.stringify({ provider, token });
        message = 'authorization:' + provider + ':success:' + payload;
        setStatus('授权成功，正在返回后台...');
        sendToCms();
        setTimeout(() => {
          if (window.opener) {
            window.close();
            return;
          }

          window.location.href = '/admin/?auth=github';
        }, 1200);
      }

      function fail(error, code = 'TOKEN_REQUEST_FAILED') {
        const payload = JSON.stringify({ provider, error, errorCode: code });
        message = 'authorization:' + provider + ':error:' + payload;
        setStatus(error, true);
        sendToCms();
      }

      async function postJSON(url, body) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        return response.json();
      }

      async function poll(deviceCode, interval) {
        const result = await postJSON('/api/device-token', { device_code: deviceCode });

        if (result.access_token) {
          complete(result.access_token);
          return;
        }

        if (result.error === 'authorization_pending') {
          setTimeout(() => poll(deviceCode, interval), interval * 1000);
          return;
        }

        if (result.error === 'slow_down') {
          setTimeout(() => poll(deviceCode, interval + 5), (interval + 5) * 1000);
          return;
        }

        if (result.error === 'device_flow_disabled') {
          fail('这个 GitHub OAuth App 还没有启用 Device Flow。请在 OAuth App 设置里勾选 Enable Device Flow 后再试。');
          return;
        }

        fail(result.error_description || result.error || 'GitHub 授权失败，请重新尝试。');
      }

      async function start() {
        try {
          const result = await postJSON('/api/device-start', { scope });
          if (result.error) {
            fail(result.error_description || result.error);
            return;
          }

          loadingEl.hidden = true;
          authEl.hidden = false;
          codeEl.textContent = result.user_code;
          linkEl.href = result.verification_uri || 'https://github.com/login/device';
          copyButton.addEventListener('click', async () => {
            await navigator.clipboard.writeText(result.user_code);
            setStatus('授权码已复制。');
          });
          setStatus('等待 GitHub 确认...');
          poll(result.device_code, result.interval || 5);
        } catch (error) {
          fail('无法连接 GitHub 授权服务，请检查网络后重试。');
        }
      }

      start();
    </script>
  </body>
</html>`;
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  if (provider !== 'github') {
    return new Response('Unsupported provider', { status: 400 });
  }

  return new Response(page({ scope: getGithubAuthScope(env, url.searchParams.get('scope') || '') }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
