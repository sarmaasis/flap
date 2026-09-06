/**
 * Lightweight node-runnable checks for pricing math.
 * Run: npx tsx shared/calculator.test.ts
 */
import {
  flapPlanForDomains,
  googleWorkspaceMonthlyCost,
  savingsVsGoogle,
  yearlyPriceFromMonthly,
  PLANS,
} from "./plans";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLANS.free.limits.domains === 2, "Free domains");
assert(PLANS.free.limits.storage_bytes === 500 * 1024 * 1024, "Free storage 500MB");
assert(PLANS.free.limits.send_per_month === 400, "Free sends");
assert(PLANS.solo.price_monthly === 7, "Solo is $7");
assert(PLANS.solo.price_yearly === 67, "Solo yearly ~$67");
assert(PLANS.builder.price_monthly === 19, "Builder is $19");
assert(PLANS.builder.price_yearly === 182, "Builder yearly ~$182");
assert(PLANS.studio.price_monthly === 39, "Studio is $39");
assert(PLANS.studio.price_yearly === 374, "Studio yearly ~$374");
assert(PLANS.builder.highlighted === true, "Builder is highlighted");
assert(PLANS.solo.limits.domains === 5, "Solo domains");
assert(PLANS.builder.limits.domains === 20, "Builder domains");
assert(PLANS.studio.limits.domains === 40, "Studio domains");
assert(PLANS.studio.limits.team_seats === 10, "Studio seats");
assert(yearlyPriceFromMonthly(7) === 67, "yearly math 7");
assert(yearlyPriceFromMonthly(19) === 182, "yearly math 19");
assert(yearlyPriceFromMonthly(39) === 374, "yearly math 39");

assert(flapPlanForDomains(1).id === "free", "1 domain -> free");
assert(flapPlanForDomains(2).id === "free", "2 domains -> free");
assert(flapPlanForDomains(5).id === "solo", "5 domains -> solo");
assert(flapPlanForDomains(6).id === "builder", "6 domains -> builder");
assert(flapPlanForDomains(20).id === "builder", "20 domains -> builder");
assert(flapPlanForDomains(21).id === "studio", "21 domains -> studio");

assert(googleWorkspaceMonthlyCost(8, 1) === 56, "8x1 Workspace = $56");
assert(googleWorkspaceMonthlyCost(5, 2) === 70, "5x2 Workspace = $70");

const s = savingsVsGoogle(8, 1);
assert(s.google_monthly === 56, "calc google");
assert(s.flap_monthly === 19, "calc flap builder");
assert(s.savings_monthly === 37, "calc monthly save");
assert(s.savings_annual === 444, "calc annual save");

console.log("shared/plans calculator checks passed");
