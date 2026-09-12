/**
 * Plan catalog unit tests.
 * Run: npx tsx shared/calculator.test.ts
 */

import {
  PLANS,
  SHARED_STACK_FEATURES,
  yearlyPriceFromMonthly,
  scaleMonthlyPrice,
  scaleYearlyPrice,
  clampScaleMailboxes,
} from "./plans.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(PLANS.free.limits.domains === 2, "Free domains");
assert(PLANS.free.limits.mailboxes === 2, "Free mailboxes (keep wedge)");
assert(PLANS.solo.price_monthly === 6, "Solo is $6");
assert(PLANS.solo.price_yearly === 60, "Solo yearly $60");
assert(PLANS.pro.price_monthly === 15, "Pro is $15");
assert(PLANS.pro.price_yearly === 150, "Pro yearly $150");
assert(PLANS.team.price_monthly === 35, "Team is $35");
assert(PLANS.solo.limits.mailboxes === 3, "Solo mailboxes");
assert(PLANS.pro.limits.mailboxes === 8, "Pro mailboxes");
assert(PLANS.team.limits.mailboxes === 18, "Team mailboxes");
assert(PLANS.solo.limits.domains === 25, "Solo domains");
assert(PLANS.solo.limits.send_per_month === 8_000, "Solo sends");
assert(yearlyPriceFromMonthly(6) === 60, "yearly helper");
assert(clampScaleMailboxes(10) === 19, "scale min");
assert(scaleMonthlyPrice(30) === 90, "scale 30 monthly");
assert(scaleYearlyPrice(30) === 900, "scale 30 yearly");
assert(SHARED_STACK_FEATURES.length >= 10, "shared stack listed");

console.log("shared/plans calculator checks passed");
