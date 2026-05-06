// Smart Model Queue Manager
// Tracks per-model task progress for AutoTester with resume capability

const STORAGE_PREFIX = "auto_tester_model_queue_";

export function getModelKey(providerKey, modelValue) {
  return `${providerKey}|${modelValue}`;
}

export function groupMatrixByModel(matrix) {
  const groups = [];
  let current = null;

  for (let i = 0; i < matrix.length; i++) {
    const step = matrix[i];
    const key = getModelKey(step.providerKey, step.modelValue);

    if (!current || current.key !== key) {
      current = {
        key,
        providerKey: step.providerKey,
        provider: step.provider,
        modelValue: step.modelValue,
        modelLabel: step.modelLabel,
        startIdx: i,
        endIdx: i,
        count: 1,
      };
      groups.push(current);
    } else {
      current.endIdx = i;
      current.count++;
    }
  }

  return groups;
}

export function initModelProgress(groups) {
  const state = {};
  for (const g of groups) {
    state[g.key] = {
      completed: 0,
      total: g.count,
      status: "pending",
      cooldownUntil: null,
      retryCount: 0,
    };
  }
  return state;
}

export function loadModelQueue(type) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + type);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveModelQueue(type, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + type, JSON.stringify(data));
  } catch {}
}

export function clearModelQueue(type) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + type);
  } catch {}
}

export function getModelSummary(modelProgress) {
  const total = Object.keys(modelProgress).length;
  let completed = 0;
  let paused = 0;
  let failed = 0;
  let pending = 0;

  Object.values(modelProgress).forEach((mp) => {
    if (mp.status === "completed") completed++;
    else if (mp.status === "paused") paused++;
    else if (mp.status === "failed") failed++;
    else pending++;
  });

  return { total, completed, paused, failed, pending };
}
