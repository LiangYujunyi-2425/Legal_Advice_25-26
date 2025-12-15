// client to call remote predict endpoint and parse text/event-stream SSE
// NOTE: This version uses a hard-coded Cloud Run endpoint (no env vars) as requested.
// Ensure the client posts to the /predict route on the remote service
const PREDICT_ENDPOINT = 'https://api-926721049029.us-central1.run.app/predict';
// Use a relative path for the local proxy so the browser will call the dev server
// (Vite dev server proxies /predict -> Cloud Run). In Codespaces the browser
// cannot reach container localhost, so a relative path ensures requests go to
// the same origin (the dev server) which will forward them.
const LOCAL_PROXY = '/predict';

/**
 * async generator that yields parsed SSE payloads from the /predict endpoint.
 * Each yield can be a string or an object depending on the server payload.
 */
export async function* streamPredict(prompt, has_contract = false, apiKey = null, sessionId = null, recentN = 6) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // If sessionId provided, try to fetch recent messages from cache and prepend
  let promptToSend = prompt;
  if (sessionId) {
    try {
      // For testing, use local cache backend
      const cacheBase = 'http://localhost:5000';
      const url = `${cacheBase}/cache/${encodeURIComponent(sessionId)}/recent?n=${encodeURIComponent(recentN)}`;
      const cacheRes = await fetch(url);
      if (cacheRes && cacheRes.ok) {
        const data = await cacheRes.json();
        if (data && Array.isArray(data.recent) && data.recent.length) {
          const prefix = data.recent.map(m => `${m.role}: ${m.content}`).join('\n');
          promptToSend = prefix + '\nUser: ' + prompt;
        }
      }
    } catch (e) {
      // ignore cache errors and continue with original prompt
      console.warn('Failed to fetch recent cache', e && e.message);
    }
  }

  // try direct fetch first
  let res;
  try {
    res = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ system_prompt: "", user_question: promptToSend })
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
        // If your local proxy expects the new format, switch this to system_prompt/user_question too.
        body: JSON.stringify({ instances: [{ text: promptToSend }], has_contract })
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
  if (!reader) {
    throw new Error("response body 不支援 getReader()");
  }

  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });

    // 找出所有以 data: 開頭的行，但保留原始 \n
    const matches = buf.match(/^data:\s*(.*)$/gm);
    buf = ''; // 清空 buffer

    if (matches) {
      for (const m of matches) {
        // 保留原始字串，包括可能存在的 \n（注意：這裡 m 是單行，\n 會存在於 payload 原始 JSON 字串中）
        const payload = m.slice('data: '.length);

        if (payload === '[DONE]') return;

        try {
          const obj = JSON.parse(payload);
          // 若 obj.output 內含 \n，前端用 white-space: pre-line 顯示即可
          yield obj;
        } catch {
          // 非 JSON → 字串，保留原始內容
          yield payload;
        }
      }
    }
  }
}

export default streamPredict;