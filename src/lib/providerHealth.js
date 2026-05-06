// Lightweight in-memory provider health tracking.
//
// Records success / failure / rate-limit signals per (model, key-prefix) and
// computes a simple recency-weighted score that the route handler can use to
// reorder fallback queues. Purely advisory — never blocks a request.
//
// The store lives in module scope so it survives across requests within a
// single Node.js worker. On serverless cold start it resets to neutral, which
// is the safe default. We deliberately avoid persistent storage to keep the
// keys server-only and ephemeral.

const STATS = new Map(); // key: model, value: { success, fail, rateLimit, lastFailAt, lastSuccessAt }
const COOLDOWN_MS = 60 * 1000; // 1 min after a 429 we deprioritise the model
const MAX_DECAY_MS = 10 * 60 * 1000; // counts decay to zero over 10 min

function bucket(model) {
  let b = STATS.get(model);
  if (!b) {
    b = { success: 0, fail: 0, rateLimit: 0, lastFailAt: 0, lastSuccessAt: 0, lastRateLimitAt: 0 };
    STATS.set(model, b);
  }
  return b;
}

function decayedCount(count, lastTs) {
  if (!count || !lastTs) return 0;
  const age = Date.now() - lastTs;
  if (age >= MAX_DECAY_MS) return 0;
  return count * (1 - age / MAX_DECAY_MS);
}

export function recordSuccess(model) {
  if (!model) return;
  const b = bucket(model);
  b.success += 1;
  b.lastSuccessAt = Date.now();
}

export function recordFailure(model, kind = "fail") {
  if (!model) return;
  const b = bucket(model);
  if (kind === "rate_limit") {
    b.rateLimit += 1;
    b.lastRateLimitAt = Date.now();
  } else {
    b.fail += 1;
    b.lastFailAt = Date.now();
  }
}

export function getScore(model) {
  if (!model) return 0;
  const b = STATS.get(model);
  if (!b) return 0;

  const recentSuccess = decayedCount(b.success, b.lastSuccessAt);
  const recentFail = decayedCount(b.fail, b.lastFailAt);
  const recentRate = decayedCount(b.rateLimit, b.lastRateLimitAt);

  // Cool-down penalty if we hit a 429 very recently.
  const sinceRate = Date.now() - (b.lastRateLimitAt || 0);
  const coolDown = sinceRate < COOLDOWN_MS ? -5 : 0;

  return recentSuccess * 1.0 - recentFail * 0.5 - recentRate * 1.0 + coolDown;
}

// Reorder a fallback queue using observed health. The first entry stays first
// (it represents the user's explicit choice) — we only reorder the tail.
export function reorderQueue(queue) {
  if (!Array.isArray(queue) || queue.length <= 2) return queue;
  const head = queue[0];
  const tail = queue.slice(1).slice().sort((a, b) => getScore(b.model) - getScore(a.model));
  return [head, ...tail];
}

// For diagnostics / tests.
export function snapshot() {
  const out = {};
  for (const [k, v] of STATS.entries()) {
    out[k] = { ...v, score: getScore(k) };
  }
  return out;
}

export function _resetForTests() {
  STATS.clear();
}
