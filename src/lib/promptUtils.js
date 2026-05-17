export function parseNumberedPrompts(text, maxCount = 0) {
  let cleaned = text;

  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const danglingThinking = cleaned.search(/<thinking>/i);
  if (danglingThinking !== -1) {
    cleaned = cleaned.slice(0, danglingThinking).trim();
  }
  const danglingThink = cleaned.search(/<think>/i);
  if (danglingThink !== -1) {
    cleaned = cleaned.slice(0, danglingThink).trim();
  }

  try {
    let jsonSource = cleaned;
    if (jsonSource.startsWith("```")) {
      jsonSource = jsonSource.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const jsonMatch = jsonSource.match(/\{[\s\S]*"prompts"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.prompts)) {
        const result = parsed.prompts
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter(Boolean);
        if (result.length > 0) {
          return maxCount > 0 ? result.slice(0, maxCount) : result;
        }
      }
    }
  } catch {}

  const lines = cleaned.split("\n");
  const numbered = [];
  let currentPrompt = "";

  for (const line of lines) {
    const stripped = line.replace(/\*\*/g, "").trim();
    const match = stripped.match(/^\d+[\.\)\-\:]\s*(.+)/);
    if (match) {
      if (currentPrompt) numbered.push(currentPrompt.trim());
      currentPrompt = match[1].replace(/^[""]|[""]$/g, "").trim();
    } else if (currentPrompt && stripped && !stripped.match(/^(here|sure|below|i |let me|---)/i)) {
      currentPrompt += " " + stripped;
    }
  }
  if (currentPrompt) numbered.push(currentPrompt.trim());

  if (numbered.length > 0) {
    return maxCount > 0 ? numbered.slice(0, maxCount) : numbered;
  }

  return [];
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Copy a list of prompts in an Excel-friendly format so that pasting into a
// spreadsheet drops each prompt into its own row (rather than every prompt
// collapsing into a single cell).  We publish both:
//   - text/html  : a <table> with one <tr> per prompt — spreadsheets prefer
//                  this when available and use it to assign rows.
//   - text/plain : the same prompts joined with CRLF — works as a graceful
//                  fallback for plain text targets and older clipboards.
export async function copyPromptsAsRows(prompts) {
  const list = Array.isArray(prompts) ? prompts.filter(p => typeof p === "string" && p.length > 0) : [];
  if (list.length === 0) return false;

  const escapeHtml = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Strip tabs and CR/LF from each prompt so the row boundaries stay intact
  // when the clipboard target falls back to text/plain.
  const sanitizedPlain = list.map(p => String(p).replace(/[\r\n\t]+/g, " ").trim());
  const plain = sanitizedPlain.join("\r\n");

  const html =
    `<table><tbody>` +
    sanitizedPlain.map(p => `<tr><td>${escapeHtml(p)}</td></tr>`).join("") +
    `</tbody></table>`;

  try {
    if (typeof window !== "undefined" && window.ClipboardItem && navigator.clipboard?.write) {
      const item = new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {}

  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

export function downloadPromptsCsv(prompts, filenamePrefix = "prompts") {
  const csv =
    "Number,Prompt\n" +
    prompts.map((prompt, index) => `${index + 1},"${prompt.replace(/"/g, '""')}"`).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${Date.now()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPromptsTxt(prompts, filenamePrefix = "prompts") {
  const txt = prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n\n");
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
