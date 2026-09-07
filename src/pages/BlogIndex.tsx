import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { ArrowUpRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { BLOG_POSTS } from "../content/blog";

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
      <div className="flap-journal">
        <header className="flap-journal-header">
          <div><span className="flap-eyebrow">The Flap journal</span><h1>A better way<br />to work with email.</h1></div>
          <p>Practical notes for people building things. Set up your domains, find your workflow, and make more space for the work that matters.</p>
        </header>
        <div className="journal-tools">
          <div className="journal-filters" aria-label="Filter articles">{tags.map(t => <button key={t} aria-pressed={tag === t} onClick={() => setTag(t)}>{t}</button>)}</div>
          <input className="journal-search" type="search" aria-label="Search articles" placeholder="Find a guide…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <p className="sr-only" role="status">{posts.length} articles found</p>
        <ul className="journal-grid">
          {posts.map((post, i) => <li key={post.slug} className="journal-card">
            <a href={post.path} onClick={e => { e.preventDefault(); go(post.path); }}>
              <div className="journal-meta"><span>{post.tags[0] || "Guide"}{i === 0 && !query && tag === "All" ? " · Featured" : ""}</span><time dateTime={post.updated}>{post.updated}</time></div>
              <h2>{post.h1}</h2><p>{post.lede}</p><span className="journal-read">Read the story <ArrowUpRight size={16} /></span>
            </a>
          </li>)}
        </ul>
        {posts.length === 0 && <div className="app-feature-empty"><h2>No matching articles</h2><p>Try another keyword or browse all guides.</p><Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setTag("All"); }}>Clear filters</Button></div>}
        <div className="mt-12 flex flex-wrap gap-3"><Button onClick={() => go("/signup")}>Start free</Button><Button variant="outline" onClick={() => go("/guides")}>Explore setup guides</Button></div>
      </div>
    </MarketingShell>
  );
}
