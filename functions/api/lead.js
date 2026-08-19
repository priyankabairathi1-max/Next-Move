// Cloudflare Pages Function — automatically becomes the route /api/lead
//
// This does NOT use the google-spreadsheet npm library (it relies on Node.js
// APIs that don't exist in Cloudflare's edge runtime). Instead it talks to
// Google's REST API directly: sign a short-lived JWT with your service
// account's private key using the browser-standard Web Crypto API, trade
// that for an access token, then call the Sheets API to append a row.
// No dependencies to install — this file is self-contained.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
  }

  const required = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) {
    console.error('Missing env vars for lead.js:', missing.join(', '));
    return jsonResponse({ ok: false, warning: 'Lead storage not configured' }, 200);
  }

  const row = [
    new Date().toISOString(),
    body.email || '',
    body.followers || '',
    body.frequency || '',
    body.niche || '',
    body.sellDescription || '',
    body.listSize || '',
    body.emailFrequency || '',
    body.nurtureSequence || '',
    body.offersSummary || '',
    body.goal || '',
    body.problem || '',
    body.linkedinUrl || '',
    body.category || '',
    body.headline || '',
    body.timePerWeek || '',
    body.adBudget || '',
    body.timeline || '',
    body.requestedFullFunnel ? 'Yes' : ''
  ];

  try {
    await appendRowToSheet(env, row);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error('lead.js error:', err.message || err);
    return jsonResponse({ ok: false, warning: 'Could not save lead' }, 200);
  }
}

async function appendRowToSheet(env, rowValues) {
  const accessToken = await getGoogleAccessToken(env);
  const range = 'A1';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [rowValues] })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets append failed (${res.status}): ${errText}`);
  }
}

async function getGoogleAccessToken(env) {
  const privateKeyPem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64urlFromBuffer(signatureBuffer)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error('Google auth failed: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
