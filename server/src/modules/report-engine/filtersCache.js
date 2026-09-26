const cache = new Map();
export function cached(key, loader, ttlMs = 900000) {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = Promise.resolve().then(loader).then((result) => { cache.set(key, { value: result, expiresAt: Date.now() + ttlMs }); return result; });
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}