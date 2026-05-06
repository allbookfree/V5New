const STORAGE_KEY = "ai-prompt-studio-templates";
const MAX_TEMPLATES = 50;

function loadTemplates() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplatesData(templates) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {}
}

export function getTemplates() {
  return loadTemplates();
}

export function addTemplate(template) {
  const templates = loadTemplates();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    concept: template.concept,
    type: template.type || "image",
    mode: template.mode || "auto",
    market: template.market || "All Marketplaces",
    style: template.style || "",
    mood: template.mood || "",
    lighting: template.lighting || "",
    createdAt: new Date().toISOString(),
    useCount: 0,
  };
  templates.unshift(entry);
  if (templates.length > MAX_TEMPLATES) templates.length = MAX_TEMPLATES;
  saveTemplatesData(templates);
  return entry;
}

export function removeTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  saveTemplatesData(templates);
  return templates;
}

export function incrementUseCount(id) {
  const templates = loadTemplates();
  const t = templates.find(t => t.id === id);
  if (t) {
    t.useCount = (t.useCount || 0) + 1;
    t.lastUsedAt = new Date().toISOString();
    saveTemplatesData(templates);
  }
  return templates;
}

export function clearAllTemplates() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
