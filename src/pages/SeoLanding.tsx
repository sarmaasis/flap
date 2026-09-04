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
import { getSeoPage } from "../content/seo-pages";
import { SITE_URL } from "../content/marketing";
import { trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  clearJsonLd,
  faqPageLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webPageLd,
} from "../lib/seo";

export { getSeoPage } from "../content/seo-pages";
export type { SeoPageDef } from "../content/seo-pages";

export default function SeoLanding({ path }: { path: string }) {
  const page = getSeoPage(path);

  useEffect(() => {
    if (!page) return;
    setPageMeta({
      title: page.title,
      description: page.description,
      path: page.path,
      type: page.comparison ? "website" : "website",
    });
    trackOnce(`seo_${page.path}`, page.comparison ? "comparison_page_view" : "seo_page_view", {
      path: page.path,
    });
    setJsonLd("flap-webpage", webPageLd({
      path: page.path,
      title: page.title,
      description: page.description,
      dateModified: page.updated,
    }));
    setJsonLd("flap-software", softwareApplicationLd());
    if (page.faqs.length) {
      setJsonLd("flap-faq", faqPageLd(page.faqs));
    } else {
      clearJsonLd("flap-faq");
    }
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-faq");
    };
  }, [page]);

  if (!page) {
    return (
      <MarketingShell>
        <div className="mx-auto max-w-3xl px-5 py-24">
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <Button className="mt-6" onClick={() => go("/")}>
            Home
          </Button>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Flap · useflap.online
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          {page.h1}
        </h1>
        <LastUpdated date={page.updated} />
        <DefinitionBox>{page.definition}</DefinitionBox>
        <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">{page.lede}</p>
        <ArticleCtas source={page.path} />

        {page.table ? (
          <ComparisonTable caption={page.table.caption} headers={page.table.headers} rows={page.table.rows} />
        ) : null}

        <div className="mt-14 space-y-10">
          {page.sections.map((s) => (
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
            </section>
          ))}
        </div>

        <FaqBlock faqs={page.faqs} />
        <RelatedLinks links={page.related} />

        <p className="mt-8 text-xs text-[var(--muted)]">
          <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>
          {" · "}
          Entities: Flap, useflap.online, custom domain email
        </p>
      </article>
    </MarketingShell>
  );
}
