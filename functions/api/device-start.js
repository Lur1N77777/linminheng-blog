const CLIENT_ID = 'Ov23liznygioUFqG4IFY';

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function onRequestPost({ request }) {
  const { scope = 'repo,user' } = await readJSON(request);

  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope,
    }),
  });

  const result = await response.json();

  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  });
}
