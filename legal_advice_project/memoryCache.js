// Simple in-memory conversation cache
// Map sessionId => [{ role, content, ts }]

const cache = new Map();

const DEFAULT_MAX = 8;

function _ensure(sessionId) {
  if (!cache.has(sessionId)) cache.set(sessionId, { msgs: [], max: DEFAULT_MAX });
  return cache.get(sessionId);
}

function pushMessage(sessionId, message, max) {
  const entry = _ensure(sessionId);
  if (typeof max === 'number') entry.max = max;
  const msg = { ...message, ts: Date.now() };
  entry.msgs.push(msg);
  // trim to max recent
  while (entry.msgs.length > entry.max) entry.msgs.shift();
  return msg;
}

function getRecent(sessionId, n) {
  const entry = cache.get(sessionId);
  if (!entry) return [];
  const take = typeof n === 'number' ? n : entry.msgs.length;
  return entry.msgs.slice(-take);
}

function clearSession(sessionId) {
  cache.delete(sessionId);
}

function setMax(sessionId, max) {
  const entry = _ensure(sessionId);
  entry.max = max;
  while (entry.msgs.length > entry.max) entry.msgs.shift();
}

function composePrompt(sessionId, incoming, opts = {}) {
  // returns an array of messages: recent + incoming
  const recent = getRecent(sessionId, opts.n ?? undefined);
  if (!incoming) return recent;
  return [...recent, incoming];
}

export { pushMessage, getRecent, clearSession, setMax, composePrompt };
