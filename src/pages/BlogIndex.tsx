import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { ArrowUpRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { BLOG_POSTS } from "../content/blog";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

import { trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  clearJsonLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webPageLd,
} from "../lib/seo";

const INDEX_PATH = "/blog";
const INDEX_TITLE = "Blog — custom domain email for founders | Flap";
const INDEX_DESC =
  "Practical posts on multi-domain email, Workspace cost, DNS (MX/SPF/DMARC), and hosted vs self-host mail — from Flap (useflap.online).";

export default function BlogIndex() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const tags = ["All", ...new Set(BLOG_POSTS.flatMap(p => p.tags))];
  const posts = BLOG_POSTS.filter(p => (tag === "All" || p.tags.includes(tag)) && `${p.h1} ${p.lede} ${p.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    setPageMeta({ title: INDEX_TITLE, description: INDEX_DESC, path: INDEX_PATH });
    trackOnce("blog_index", "seo_page_view", { path: INDEX_PATH });
    setJsonLd(
      "flap-webpage",
      webPageLd({
        path: INDEX_PATH,
        title: INDEX_TITLE,
        description: INDEX_DESC,
        dateModified: "2026-09-04",
      }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    setJsonLd("flap-blog-list", {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Flap Blog",
      url: "https://useflap.online/blog",
      description: INDEX_DESC,
      publisher: { "@type": "Organization", name: "Flap", url: "https://useflap.online" },
      blogPost: BLOG_POSTS.map((p) => ({
        "@type": "BlogPosting",
        headline: p.h1,
        url: `https://useflap.online${p.path}`,
        datePublished: p.published,
        dateModified: p.updated,
        description: p.description,
      })),
    });
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-blog-list");
    };
  }, []);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-[1152px] px-5 py-10 md:px-8 md:py-16 md:pb-20">
        <header className="grid items-end gap-5 border-b border-[var(--line-strong)] pb-10 md:grid-cols-[1.3fr_1fr] md:gap-12">
          <div>
            <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--foreground-muted)] uppercase">The Flap journal</span>
            <h1 className="mt-4 font-[family-name:var(--font-serif)] text-[clamp(36px,5vw,58px)] leading-[1.1] font-normal tracking-[-0.04em]">A better way<br />to work with email.</h1>
          </div>
          <p className="text-[17px] leading-[1.7] text-[var(--foreground-muted)]">Practical notes for people building things. Set up your domains, find your workflow, and make more space for the work that matters.</p>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <div className="flex flex-wrap gap-1.5" aria-label="Filter articles">{tags.map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
              className={cn(
                "cursor-pointer rounded-[5px] border border-[var(--line)] px-3 py-2 text-[13px]",
                tag === t && "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]",
              )}
            >{t}</button>
          ))}</div>
          <input className="min-w-[240px] rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--foreground)]" type="search" aria-label="Search articles" placeholder="Find a guide…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <p className="sr-only" role="status">{posts.length} articles found</p>
        <ul className="grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
          {posts.map((post, i) => (
            <li key={post.slug} className={cn("rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]", i === 0 && !query && tag === "All" && "bg-[var(--landing-compare)] md:col-span-2")}>
              <a href={post.path} className="flex h-full flex-col p-[30px] text-inherit no-underline" onClick={e => { e.preventDefault(); go(post.path); }}>
                <div className="flex justify-between gap-2.5 text-xs text-[var(--foreground-muted)]"><span>{post.tags[0] || "Guide"}{i === 0 && !query && tag === "All" ? " · Featured" : ""}</span><time dateTime={post.updated}>{post.updated}</time></div>
                <h2 className={cn("mt-[22px] mb-3.5 max-w-[800px] text-[25px] font-medium leading-[1.25] tracking-[-0.035em]", i === 0 && !query && tag === "All" && "font-[family-name:var(--font-serif)] text-4xl")}>{post.h1}</h2>
                <p className="text-base leading-[1.65] text-[var(--foreground-muted)]">{post.lede}</p>
                <span className="mt-auto flex items-center gap-2 pt-6 text-sm">Read the story <ArrowUpRight size={16} /></span>
              </a>
            </li>
          ))}
        </ul>
        {posts.length === 0 && (
          <div className="rounded-2xl border border-[var(--line)] px-7 py-10">
            <h2>No matching articles</h2>
            <p className={tw.muted}>Try another keyword or browse all guides.</p>
            <Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setTag("All"); }}>Clear filters</Button>
          </div>
        )}
        <div className="mt-12 flex flex-wrap gap-3"><Button onClick={() => go("/signup")}>Start free</Button><Button variant="outline" onClick={() => go("/guides")}>Explore setup guides</Button></div>
      </div>
    </MarketingShell>
  );
}
