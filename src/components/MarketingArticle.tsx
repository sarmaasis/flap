import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";
import { go } from "../lib/nav";
import { track } from "../lib/analytics";

export function LastUpdated({ date, verified }: { date: string; verified?: boolean }) {
  return (
    <p className="mt-3 text-sm text-[var(--muted)]">
      {verified ? "Last verified" : "Last updated"}: <time dateTime={date}>{date}</time>
    </p>
  );
}

export function DefinitionBox({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-lg border border-[var(--line)] px-4 py-3 text-[15px] leading-relaxed text-[var(--fg)]"
      style={{ background: "color-mix(in oklab, var(--fg) 3%, transparent)" }}
    >
      <span className="font-semibold">In short: </span>
      {children}
    </p>
  );
}

export function ComparisonTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <figure className="mt-10 overflow-x-auto">
      <figcaption className="mb-3 text-sm font-medium text-[var(--fg)]">{caption}</figcaption>
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line-strong)]">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold text-[var(--fg)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--line)]">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2.5 align-top text-[var(--muted)] ${j === 0 ? "font-medium text-[var(--fg)]" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function FaqBlock({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  if (!faqs.length) return null;
  return (
    <section className="mt-14">
      <h2 className="mb-6 text-xl font-semibold">FAQ</h2>
      <Accordion type="single" collapsible>
        {faqs.map((f, i) => (
          <AccordionItem key={f.q} value={`f-${i}`}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function RelatedLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  if (!links.length) return null;
  return (
    <section className="mt-14 border-t border-[var(--line)] pt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide">Related</h2>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {links.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              className="text-[var(--cta)] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                go(r.href);
              }}
            >
              {r.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ArticleCtas({ source }: { source: string }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button asChild>
        <a
          href="/signup"
          onClick={(e) => {
            e.preventDefault();
            track("signup_clicked", { source });
            track("signup_cta_clicked", { source });
            go("/signup");
          }}
        >
          Start free
        </a>
      </Button>
      <Button asChild variant="outline">
        <a
          href="/pricing"
          onClick={(e) => {
            e.preventDefault();
            track("content_to_pricing", { source });
            go("/pricing");
          }}
        >
          See pricing
        </a>
      </Button>
      <Button asChild variant="outline">
        <a
          href="/tools/google-workspace-cost-calculator"
          onClick={(e) => {
            e.preventDefault();
            go("/tools/google-workspace-cost-calculator");
          }}
        >
          Cost calculator
        </a>
      </Button>
    </div>
  );
}
