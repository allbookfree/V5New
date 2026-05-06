const MAX_HISTORY = 150;
const SAMPLE_SIZE = 12;

export function getPromptHistory(type) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`ph_${type}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveToPromptHistory(type, prompts) {
  if (typeof window === "undefined") return;
  try {
    const clean = prompts.filter(p => typeof p === "string" && p.trim().length > 20).map(p => p.trim());
    if (clean.length === 0) return;
    const existing = getPromptHistory(type);
    const combined = [...clean, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(`ph_${type}`, JSON.stringify(combined));
  } catch {}
}

export function getAntiRepeatSample(type) {
  const history = getPromptHistory(type);
  if (history.length === 0) return [];
  const shuffled = [...history].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(SAMPLE_SIZE, history.length));
}

export function getHistoryCount(type) {
  return getPromptHistory(type).length;
}

export function removeFromPromptHistory(type, index) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(`ph_${type}`);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || index < 0 || index >= arr.length) return;
    arr.splice(index, 1);
    localStorage.setItem(`ph_${type}`, JSON.stringify(arr));
  } catch {}
}

export function clearPromptHistory(type) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(`ph_${type}`); } catch {}
}
