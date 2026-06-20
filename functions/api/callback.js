const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function escapeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function authResult({ token, error, errorCode = 'TOKEN_REQUEST_FAILED' }) {
  const status = token ? 'success' : 'error';
  const payload = token ? { provider: 'github', token } : { provider: 'github', error, errorCode };

  return new Response(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>GitHub 登录</title>
  </head>
  <body style="margin:24px;background:#111;color:#eee;font:15px system-ui">
    正在返回内容管理器...
    <script>
      const provider = 'github';
      const message = 'authorization:' + provider + ':${status}:' + ${escapeForScript(JSON.stringify(payload))};
      function send(event) {
        if (event.data === 'authorizing:' + provider) {
          window.opener && window.opener.postMessage(message, event.origin);
          window.removeEventListener('message', send);
        }
      }
      window.addEventListener('message', send);
      window.opener && window.opener.postMessage('authorizing:' + provider, window.location.origin);
    </script>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': 'sveltia_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
        'cache-control': 'no-store',
      },
    },
  );
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(request.headers.get('cookie') || '');

  if (!code || !state || state !== cookies.sveltia_oauth_state) {
    return authResult({ error: 'GitHub 登录状态校验失败，请回到后台重新登录。', errorCode: 'CSRF_DETECTED' });
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return authResult({ error: 'GitHub OAuth 环境变量没有配置完成。' });
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    return authResult({ error: 'GitHub token 请求失败，请稍后重试。' });
  }

  const result = await tokenResponse.json();

  if (!result.access_token) {
    return authResult({ error: result.error_description || result.error || 'GitHub 没有返回 access token。' });
  }

  return authResult({ token: result.access_token });
}
