import { getGithubAuthScope, getGithubClientId, noStoreJson } from '../_shared/github-oauth.js';

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function onRequestPost({ env, request }) {
  const { scope = '' } = await readJSON(request);

  let response;
  try {
    response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getGithubClientId(env),
        scope: getGithubAuthScope(env, scope),
      }),
    });
  } catch {
    return noStoreJson({
      error: 'github_unreachable',
      error_description: 'GitHub authorization service is unreachable.',
    }, { status: 502 });
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return noStoreJson({
      error: 'github_invalid_response',
      error_description: 'GitHub authorization service returned an invalid response.',
    }, { status: 502 });
  }

  return noStoreJson(result, { status: response.ok ? 200 : response.status });
}
