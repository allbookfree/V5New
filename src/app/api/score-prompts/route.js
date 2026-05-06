import { MODEL_IDS, OR_MODEL_MAP, PROVIDER_KEY_MAP } from "@/config/models";
import { fetchWithTimeout, APP_REFERER, enforceSameOrigin, readJsonBody, MAX_REQUEST_BODY_BYTES } from "@/lib/apiUtils";

function buildScoringPrompt(type) {
  const typeLabel = type === "vector" ? "vector illustration" : type === "video" ? "stock video" : "stock photo";
  return `You are a microstock commercial viability analyst. Score each ${typeLabel} prompt for its sales potential on platforms like Shutterstock, Adobe Stock, and Dreamstime.

For each prompt, provide a score from 1-10 based on these criteria:
- Commercial demand (will buyers search for and license this?)
- Visual clarity (is the prompt specific enough to produce a clear, usable result?)
- SEO potential (does it contain searchable, trending terms?)
- Uniqueness (does it stand out from generic stock content?)
- Platform suitability (is it appropriate and marketable on stock platforms?)

Return ONLY a valid JSON array of numbers, one score per prompt. Example for 3 prompts: [8, 6, 9]
No explanations, no markdown, no text — ONLY the JSON array.`;
}

function parseScores(text, count) {
  try {
    const cleaned = text
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.slice(0, count).map(n => {
          const num = Number(n);
          return Number.isFinite(num) ? Math.max(1, Math.min(10, Math.round(num))) : 5;
        });
      }
    }
  } catch { }
  return null;
}

async function callGeminiScore(apiKey, systemPrompt, userPrompt, modelKey) {
  const resolvedKey = modelKey && MODEL_IDS[modelKey] ? modelKey : "gemini";
  const modelId = MODEL_IDS[resolvedKey];
  const is25Family = modelId.startsWith("gemini-2.5-flash");
  const is3Family = modelId.startsWith("gemini-3");
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 1024,
    ...(is25Family ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    ...(is3Family ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
  };
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig,
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroqScore(apiKey, systemPrompt, userPrompt, modelKey) {
  const modelId = MODEL_IDS[modelKey] || MODEL_IDS.groq;
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callMistralScore(apiKey, systemPrompt, userPrompt) {
  const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL_IDS.mistral,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callOpenRouterScore(apiKey, systemPrompt, userPrompt, specificModel) {
  let modelId = specificModel;
  if (!modelId) {
    modelId = "openrouter/free";
  }
  const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": APP_REFERER,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callCerebrasScore(apiKey, systemPrompt, userPrompt, modelKey) {
  const modelId = MODEL_IDS[modelKey] || MODEL_IDS["cerebras-gpt-oss"] || "gpt-oss-120b";
  const res = await fetchWithTimeout("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Cerebras ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callNvidiaScore(apiKey, systemPrompt, userPrompt, modelKey) {
  const modelId = MODEL_IDS[modelKey] || MODEL_IDS["nvidia-nemotron"] || "nvidia/llama-3.3-nemotron-super-49b-v1";
  const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`NVIDIA NIM ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callHuggingFaceScore(apiKey, systemPrompt, userPrompt, modelKey) {
  const modelId = MODEL_IDS[modelKey] || MODEL_IDS["hf-qwen"] || "Qwen/Qwen2.5-72B-Instruct";
  const res = await fetchWithTimeout(
    `https://router.huggingface.co/v1/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    }
  );
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

export async function POST(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const { limited, response: limitResponse } = await (await import("@/lib/rateLimit")).rateLimit(request);
  if (limited) return limitResponse;

  let body;
  try {
    body = await readJsonBody(request, MAX_REQUEST_BODY_BYTES.prompts);
  } catch (err) {
    return Response.json({ error: err.message || "Invalid request body." }, { status: err.status || 400 });
  }
  try {
    const { prompts, type = "image", model = "gemini", apiKeys = {}, selectedModel, selectedGeminiModel, specialMode } = body;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return Response.json({ error: "No prompts to score" }, { status: 400 });
    }
    if (prompts.length > 100) {
      return Response.json({ error: "Too many prompts (max 100)" }, { status: 400 });
    }

    const systemPrompt = buildScoringPrompt(type, specialMode);
    const userPrompt = `Score these ${prompts.length} ${type} prompts:\n\n${prompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;

    const providerKey = PROVIDER_KEY_MAP[model] || model;
    const keys = Array.isArray(apiKeys[providerKey]) ? apiKeys[providerKey].filter(k => k?.trim()) : [];
    if (keys.length === 0) {
      return Response.json({ error: `No API key for ${providerKey}` }, { status: 400 });
    }

    let lastError = "";
    for (const key of keys) {
      try {
        let result = "";
        if (providerKey === "gemini") {
          result = await callGeminiScore(key, systemPrompt, userPrompt, selectedGeminiModel || model);
        } else if (providerKey === "groq") {
          result = await callGroqScore(key, systemPrompt, userPrompt, model);
        } else if (providerKey === "mistral") {
          result = await callMistralScore(key, systemPrompt, userPrompt);
        } else if (providerKey === "openrouter") {
          const orModel = OR_MODEL_MAP[selectedModel] || null;
          result = await callOpenRouterScore(key, systemPrompt, userPrompt, orModel);
        } else if (providerKey === "huggingface") {
          result = await callHuggingFaceScore(key, systemPrompt, userPrompt, model);
        } else if (providerKey === "cerebras") {
          result = await callCerebrasScore(key, systemPrompt, userPrompt, model);
        } else if (providerKey === "nvidia") {
          result = await callNvidiaScore(key, systemPrompt, userPrompt, model);
        } else {
          lastError = `Scoring not supported for provider: ${providerKey}`;
          continue;
        }

        const scores = parseScores(result, prompts.length);
        if (!scores) {
          lastError = "Unparseable scoring response";
          continue;
        }
        while (scores.length < prompts.length) scores.push(5);
        return Response.json({ scores });
      } catch (e) {
        lastError = e.message || "Provider call failed";
        continue;
      }
    }

    return Response.json({ error: lastError || "Scoring failed" }, { status: 502 });
  } catch (err) {
    try {
      const { reportError } = await import("@/lib/errorReporter");
      await reportError(err, { route: "/api/score-prompts" });
    } catch { }
    return Response.json({ error: "Scoring failed" }, { status: 500 });
  }
}
