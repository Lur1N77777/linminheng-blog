const DEFAULT_CLIENT_ID = 'Ov23liznygioUFqG4IFY';
const DEFAULT_SCOPE = 'public_repo read:user';

export function getGithubClientId(env = {}) {
  return env.GITHUB_CLIENT_ID || DEFAULT_CLIENT_ID;
}

export function getGithubAuthScope(env = {}, requestedScope = '') {
  return env.GITHUB_AUTH_SCOPE || requestedScope || DEFAULT_SCOPE;
}

export function noStoreJson(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}
