// client to call remote /predict endpoint and parse text/event-stream SSE
const PREDICT_ENDPOINT = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/predict`;

/**
 * async generator that yields parsed SSE payloads from the /predict endpoint.
 * Each yield can be a string or an object depending on the server payload.
 */
export async function* streamPredict(prompt, has_contract = false) {
  const res = await fetch(PREDICT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ text: prompt }], has_contract })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Predict API error: ${res.status} ${txt}`);
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
