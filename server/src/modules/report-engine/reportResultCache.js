const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 6;

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export default function createReportResultCache({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) {
  const entries = new Map();
  const inFlight = new Map();

  function createKey({ userId, reportId, query }) {
    return stableSerialize({ userId: String(userId), reportId, query });
  }

  function removeExpired(now = Date.now()) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  }

  function get(key) {
    removeExpired();
    const entry = entries.get(key);
    if (!entry) return null;
    entry.lastAccessedAt = Date.now();
    return entry.value;
  }

  function set(key, value) {
    removeExpired();
    entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      lastAccessedAt: Date.now(),
    });

    while (entries.size > maxEntries) {
      const oldestKey = [...entries.entries()].sort(
        ([, first], [, second]) => first.lastAccessedAt - second.lastAccessedAt,
      )[0]?.[0];
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
  }

  async function getOrCreate(key, producer) {
    const cached = get(key);
    if (cached) return { value: cached, cacheHit: true };

    if (!inFlight.has(key)) {
      inFlight.set(
        key,
        Promise.resolve()
          .then(producer)
          .then((value) => {
            set(key, value);
            return value;
          })
          .finally(() => inFlight.delete(key)),
      );
    }

    return { value: await inFlight.get(key), cacheHit: false };
  }

  return {
    createKey,
    get,
    set,
    getOrCreate,
    clear() {
      entries.clear();
      inFlight.clear();
    },
  };
}