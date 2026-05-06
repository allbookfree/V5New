import assert from "node:assert/strict";
import test from "node:test";

import { rateLimit } from "../src/lib/rateLimit.js";

function fakeRequest(ip = "1.2.3.4") {
  return {
    headers: {
      get(name) {
        if (name.toLowerCase() === "x-forwarded-for") return ip;
        return null;
      },
    },
  };
}

test("rateLimit allows requests under the budget", async () => {
  for (let i = 0; i < 50; i += 1) {
    const result = await rateLimit(fakeRequest("ip-low"));
    assert.equal(result.limited, false);
  }
});

test("rateLimit blocks requests once budget is exceeded", async () => {
  for (let i = 0; i < 100; i += 1) {
    await rateLimit(fakeRequest("ip-burst"));
  }
  const result = await rateLimit(fakeRequest("ip-burst"));
  assert.equal(result.limited, true);
  assert.ok(result.response);
  assert.equal(result.response.status, 429);
});

test("rateLimit isolates buckets per IP", async () => {
  for (let i = 0; i < 100; i += 1) {
    await rateLimit(fakeRequest("ip-victim"));
  }
  const blocked = await rateLimit(fakeRequest("ip-victim"));
  assert.equal(blocked.limited, true);

  const fresh = await rateLimit(fakeRequest("ip-fresh"));
  assert.equal(fresh.limited, false);
});

test("rateLimit handles missing forwarded-for header", async () => {
  const req = { headers: { get: () => null } };
  const result = await rateLimit(req);
  assert.equal(result.limited, false);
});
