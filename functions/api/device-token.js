const CLIENT_ID = 'Ov23liznygioUFqG4IFY';

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function onRequestPost({ request }) {
  const { device_code: deviceCode } = await readJSON(request);

  if (!deviceCode) {
    return Response.json({ error: 'missing_device_code' }, { status: 400 });
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const result = await response.json();

  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  });
}
