// Cloudflare Pages Function — this file automatically becomes the route /api/analyze
// Proxies requests to Claude's API, keeping ANTHROPIC_API_KEY server-side only.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
  }

  const { system, messages } = body || {};
  if (!system || !messages) {
    return jsonResponse({ error: 'Missing system or messages in request body' }, 400);
  }

  if (!env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables');
    return jsonResponse({ error: 'Server is not configured with an API key' }, 500);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return jsonResponse({ error: 'Anthropic API error' }, response.status);
    }

    const data = await response.json();
    return jsonResponse(data, 200);
  } catch (err) {
    console.error('analyze.js error:', err);
    return jsonResponse({ error: 'Server error calling Claude' }, 500);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
