import assert from "node:assert/strict";
import test from "node:test";

import { getUpcomingFestivals } from "../src/lib/festivalCalendar.js";

// We can't easily mock Date here without monkey-patching, so we just sanity
// check that the calendar produces *something* for the current year and that
// the Hijri-derived festivals have plausible Gregorian dates (i.e. the
// converter actually ran and we're not getting NaN dates).
test("festivalCalendar: getUpcomingFestivals returns valid date ranges", () => {
  const upcoming = getUpcomingFestivals(366);
  assert.ok(Array.isArray(upcoming));
  for (const fest of upcoming) {
    assert.ok(fest.startDate instanceof Date && !Number.isNaN(fest.startDate.getTime()), `startDate invalid for ${fest.name}`);
    assert.ok(fest.endDate instanceof Date && !Number.isNaN(fest.endDate.getTime()), `endDate invalid for ${fest.name}`);
    assert.ok(fest.startDate <= fest.endDate, `range inverted for ${fest.name}`);
  }
});

test("festivalCalendar: Islamic festivals appear in the upcoming list at least once per cycle", () => {
  // Look 13 months ahead so at least one full Hijri-Gregorian cycle is
  // covered (Hijri year is ~354 days).
  const upcoming = getUpcomingFestivals(396);
  const names = upcoming.map(f => f.name);
  // Ramadan and at least one Eid should be derivable for any 13-month window.
  const hasIslamicEvent = names.some(n => n === "Ramadan" || n === "Eid ul-Fitr" || n === "Eid ul-Adha" || n === "Muharram");
  assert.ok(hasIslamicEvent, `expected at least one Islamic festival in 13-month window, got: ${names.join(", ")}`);
});
