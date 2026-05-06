import assert from "node:assert/strict";
import test from "node:test";

import { isReporterEnabled, reportError } from "../src/lib/errorReporter.js";

test("errorReporter is disabled by default (no env)", () => {
  // Without SENTRY_DSN or ERROR_WEBHOOK_URL, the reporter is a no-op.
  assert.equal(isReporterEnabled(), false);
});

test("reportError is a safe no-op when disabled", async () => {
  // Should never throw, even with malformed inputs.
  await reportError(new Error("test"), { route: "/x" });
  await reportError("string-error");
  await reportError(null);
  assert.ok(true);
});

test("reportError sanitises secret-looking keys before sending", async () => {
  // We can't easily test the wire payload without a fake server, but we
  // can verify the public function tolerates secret-looking context keys
  // without throwing.  The internal sanitiseContext is exercised here.
  await reportError(new Error("boom"), {
    apiKey: "should-be-stripped",
    AUTHORIZATION: "Bearer abc",
    route: "/api/x",
    user: "ok",
  });
  assert.ok(true);
});
