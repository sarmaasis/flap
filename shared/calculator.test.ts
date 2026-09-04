/**
 * Lightweight node-runnable checks for pricing math.
 * Run: npx tsx shared/calculator.test.ts  (or via npm run check after importing in build)
 */
import {
  flapPlanForDomains,
  googleWorkspaceMonthlyCost,
  savingsVsGoogle,
  PLANS,
} from "./plans";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLANS.solo.price_monthly === 9, "Solo is $9");
assert(PLANS.builder.price_monthly === 19, "Builder is $19");
assert(PLANS.studio.price_monthly === 39, "Studio is $39");
assert(PLANS.builder.highlighted === true, "Builder is highlighted");
assert(PLANS.solo.limits.domains === 3, "Solo domains");
assert(PLANS.builder.limits.domains === 10, "Builder domains");
assert(PLANS.studio.limits.domains === 40, "Studio domains");

assert(flapPlanForDomains(1).id === "free", "1 domain → free");
assert(flapPlanForDomains(3).id === "solo", "3 domains → solo");
assert(flapPlanForDomains(5).id === "builder", "5 domains → builder");
assert(flapPlanForDomains(10).id === "builder", "10 domains → builder");
assert(flapPlanForDomains(11).id === "studio", "11 domains → studio");

assert(googleWorkspaceMonthlyCost(8, 1) === 56, "8×1 Workspace = $56");
assert(googleWorkspaceMonthlyCost(5, 2) === 70, "5×2 Workspace = $70");

const s = savingsVsGoogle(8, 1);
assert(s.google_monthly === 56, "calc google");
assert(s.flap_monthly === 19, "calc flap builder");
assert(s.savings_monthly === 37, "calc monthly save");
assert(s.savings_annual === 444, "calc annual save");

console.log("shared/plans calculator checks passed");
