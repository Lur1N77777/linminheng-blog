const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

function html(message, status = 500) {
  return new Response(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GitHub 登录</title><body style="margin:24px;background:#111;color:#eee;font:15px system-ui">${message}</body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  );
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  if (provider !== 'github') {
    return html('不支持的登录方式。', 400);
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return html('GitHub OAuth 还没有配置完成: 请在 Cloudflare Pages 环境变量里添加 GITHUB_OAUTH_CLIENT_ID 和 GITHUB_OAUTH_CLIENT_SECRET。');
  }

  const state = randomState();
  const callbackURL = new URL('/api/callback', url.origin);
  const scope = url.searchParams.get('scope') || 'repo,user';
  const authURL = new URL(GITHUB_AUTHORIZE_URL);

  authURL.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authURL.searchParams.set('redirect_uri', callbackURL.toString());
  authURL.searchParams.set('scope', scope);
  authURL.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authURL.toString(),
      'set-cookie': `sveltia_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'cache-control': 'no-store',
    },
  });
}
