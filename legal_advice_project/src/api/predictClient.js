// client to call remote predict endpoint and parse text/event-stream SSE
// NOTE: This version uses a hard-coded Cloud Run endpoint (no env vars) as requested.
const PREDICT_ENDPOINT = 'https://api-452141441389.europe-west1.run.app/';
// Use a relative path for the local proxy so the browser will call the dev server
// (Vite dev server proxies /predict -> Cloud Run). In Codespaces the browser
// cannot reach container localhost, so a relative path ensures requests go to
// the same origin (the dev server) which will forward them.
const LOCAL_PROXY = '/predict';

/**
 * async generator that yields parsed SSE payloads from the /predict endpoint.
 * Each yield can be a string or an object depending on the server payload.
 */
export async function* streamPredict(prompt, has_contract = false, apiKey = null) {
  const headers = { 'Content-Type': 'application/json' };
  // if caller provided an apiKey param, attach it (no env vars used)
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // try direct fetch first
  let res;
  try {
    res = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instances: [{ text: prompt }], has_contract })
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Predict API error: ${res.status} ${txt}`);
    }
  } catch (err) {
  console.warn('Direct fetch failed, attempting local proxy fallback (relative /predict):', err && err.message);
    // fallback to local proxy to avoid CORS - useful for local development
    try {
      res = await fetch(LOCAL_PROXY, {
        method: 'POST',
        headers,
        body: JSON.stringify({ instances: [{ text: prompt }], has_contract })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Proxy Predict API error: ${res.status} ${txt}`);
      }
    } catch (err2) {
      throw new Error(`Failed to fetch from predict endpoint and local proxy: ${err2 && err2.message}`);
    }
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);

      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        const prefix = 'data: ';
        if (!line.startsWith(prefix)) continue;
        const payload = line.slice(prefix.length).trim();
        if (payload === '[DONE]') return;
        try {
          const obj = JSON.parse(payload);
          yield obj;
        } catch (e) {
          yield payload;
        }
      }
    }
  }
}

export default streamPredict;
