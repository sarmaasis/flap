import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import { BLOG_POSTS } from "../content/blog";
import { MARKETING } from "../content/marketing";
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
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Blog · Flap · useflap.online
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Flap blog
        </h1>
        <LastUpdated date="2026-09-04" />
        <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
          High-intent notes for multi-domain founders — not generic “business email” fluff.{" "}
          {MARKETING.founder_tagline}
        </p>

        <ul className="mt-12 space-y-8">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug} className="border-b border-[var(--line)] pb-8">
              <a
                href={post.path}
                className="group block"
                onClick={(e) => {
                  e.preventDefault();
                  go(post.path);
                }}
              >
                <h2 className="text-xl font-semibold tracking-tight group-hover:text-[var(--cta)]">
                  {post.h1}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  <time dateTime={post.updated}>{post.updated}</time>
                  {post.tags.length ? ` · ${post.tags.slice(0, 3).join(" · ")}` : ""}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{post.lede}</p>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button onClick={() => go("/signup")}>Start free</Button>
          <Button variant="outline" onClick={() => go("/guides/cloudflare-custom-domain-email")}>
            Setup guides
          </Button>
        </div>
      </div>
    </MarketingShell>
  );
}
