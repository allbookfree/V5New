const { POST } = require('./src/app/api/generate-prompts/route.js');
const { NextRequest } = require('next/server');

async function test() {
  const req = new NextRequest('http://localhost/api/generate-prompts', {
    method: 'POST',
    body: JSON.stringify({
      concept: "auto",
      quantity: 1,
      model: "google/gemini-2.5-flash",
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
