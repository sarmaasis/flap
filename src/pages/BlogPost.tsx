import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import {
  ArticleCtas,
  ComparisonTable,
  DefinitionBox,
  FaqBlock,
  LastUpdated,
  RelatedLinks,
} from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import { getBlogPostByPath } from "../content/blog";
import { trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  articleLd,
  clearJsonLd,
  faqPageLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
} from "../lib/seo";

export default function BlogPost({ path }: { path: string }) {
  const post = getBlogPostByPath(path);

  useEffect(() => {
    if (!post) return;
    setPageMeta({
      title: post.title,
      description: post.description,
      path: post.path,
      type: "article",
    });
    trackOnce(`blog_${post.slug}`, "seo_page_view", { path: post.path });
    setJsonLd(
      "flap-article",
      articleLd({
        path: post.path,
        title: post.h1,
        description: post.description,
        datePublished: post.published,
        dateModified: post.updated,
      }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    if (post.faqs.length) setJsonLd("flap-faq", faqPageLd(post.faqs));
    return () => {
      clearJsonLd("flap-article");
      clearJsonLd("flap-software");
      clearJsonLd("flap-faq");
    };
  }, [post]);

  if (!post) {
    return (
      <MarketingShell>
        <div className="mx-auto max-w-3xl px-5 py-24">
          <h1 className="text-2xl font-semibold">Post not found</h1>
          <Button className="mt-6" onClick={() => go("/blog")}>
            All posts
          </Button>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          <a
            href="/blog"
            className="hover:underline"
            onClick={(e) => {
              e.preventDefault();
              go("/blog");
            }}
          >
            Blog
          </a>
          {" · Flap · useflap.online"}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          {post.h1}
        </h1>
        <LastUpdated date={post.updated} />
        <DefinitionBox>{post.definition}</DefinitionBox>
        <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">{post.lede}</p>
        <ArticleCtas source={post.path} />

        {post.table ? (
          <ComparisonTable caption={post.table.caption} headers={post.table.headers} rows={post.table.rows} />
        ) : null}

        <div className="mt-14 space-y-10">
          {post.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-semibold tracking-tight">{s.heading}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{s.body}</p>
              {s.bullets?.length ? (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {s.subheads?.map((sub) => (
                <div key={sub.h3} className="mt-5">
                  <h3 className="text-base font-semibold tracking-tight">{sub.h3}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{sub.body}</p>
                </div>
              ))}
            </section>
          ))}
        </div>

        <FaqBlock faqs={post.faqs} />
        <RelatedLinks
          links={[
            { href: "/blog", label: "All blog posts" },
            ...post.related,
          ]}
        />
      </article>
    </MarketingShell>
  );
}
