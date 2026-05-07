import { POST } from './src/app/api/generate-prompts/route.js';

async function test() {
  const req = new Request('http://localhost/api/generate-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept: "auto",
      quantity: 1,
      model: "gemini",
      apiKeys: ["dummy"],
      type: "vector",
      specialMode: "t-shirt-graphic"
    })
  });
  
  try {
    const res = await POST(req);
    const json = await res.json();
    console.log(json);
  } catch(e) {
    console.error("CRASH:", e);
  }
}

test();
