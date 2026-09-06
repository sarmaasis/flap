/**
 * Lightweight node-runnable checks for pricing math.
 * Run: npx tsx shared/calculator.test.ts
 */
import {
  flapPlanForDomains,
  flapPlanForMailboxes,
  googleWorkspaceMonthlyCost,
  savingsVsGoogle,
  yearlyPriceFromMonthly,
  scaleMonthlyPrice,
  scaleYearlyPrice,
  PLANS,
} from "./plans";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLANS.free.limits.domains === 2, "Free domains");
assert(PLANS.free.limits.mailboxes === 2, "Free mailboxes (keep wedge)");
assert(PLANS.free.limits.storage_bytes === 500 * 1024 * 1024, "Free storage 500MB");
assert(PLANS.free.limits.send_per_month === 200, "Free sends");
assert(PLANS.solo.price_monthly === 5, "Solo is $5");
assert(PLANS.solo.price_yearly === 50, "Solo yearly $50");
assert(PLANS.pro.price_monthly === 12, "Pro is $12");
assert(PLANS.pro.price_yearly === 120, "Pro yearly $120");
assert(PLANS.team.price_monthly === 29, "Team is $29");
assert(PLANS.team.price_yearly === 290, "Team yearly $290");
assert(PLANS.pro.highlighted === true, "Pro is highlighted");
assert(PLANS.solo.limits.domains === 5, "Solo domains");
assert(PLANS.pro.limits.domains === 15, "Pro domains");
assert(PLANS.team.limits.domains === 40, "Team domains");
assert(yearlyPriceFromMonthly(5) === 50, "yearly math 5");
assert(yearlyPriceFromMonthly(12) === 120, "yearly math 12");
assert(yearlyPriceFromMonthly(29) === 290, "yearly math 29");
assert(scaleMonthlyPrice(13) === 32.5, "scale 13 mo");
assert(scaleYearlyPrice(13) === 325, "scale 13 yr");

assert(flapPlanForMailboxes(2).id === "free", "2 mb -> free");
assert(flapPlanForMailboxes(4).id === "solo", "4 mb -> solo");
assert(flapPlanForMailboxes(12).id === "pro", "12 mb -> pro");
assert(flapPlanForMailboxes(30).id === "team", "30 mb -> team");
assert(flapPlanForMailboxes(31).id === "scale", "31 mb -> scale");

assert(flapPlanForDomains(2).id === "free", "2 domains -> free");
assert(flapPlanForDomains(5).id === "solo", "5 domains -> solo");
assert(flapPlanForDomains(15).id === "pro", "15 domains -> pro");
assert(flapPlanForDomains(40).id === "team", "40 domains -> team");

assert(googleWorkspaceMonthlyCost(8, 1) === 56, "8x1 Workspace = $56");
const s = savingsVsGoogle(8, 1);
assert(s.google_monthly === 56, "calc google");
assert(s.flap_monthly === 12, "calc flap pro $12");
assert(s.savings_monthly === 44, "calc monthly save");

console.log("shared/plans calculator checks passed");
