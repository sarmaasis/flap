import { useEffect } from "react";
import { DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/acceptable-use";

export default function DocsAcceptableUsePage() {
  useEffect(() => {
    setPageMeta({
      title: "Acceptable use | Flap Docs",
      description: "Flap acceptable use and anti-spam rules for custom-domain email.",
      path: PATH,
    });
    setJsonLd("docs-aup", webPageLd({
      title: "Acceptable use | Flap Docs",
      description: "Pointer to the public Acceptable Use Policy.",
      path: PATH,
    }));
    return () => clearJsonLd("docs-aup");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Acceptable use"
        description="The canonical policy lives on the public /acceptable-use page."
        toc={[{ id: "policy", label: "Policy" }]}
        rightRail={<DocsRelated links={[{ href: "/acceptable-use", label: "Full policy" }, { href: "/abuse", label: "Report abuse" }]} />}
      >
        <h2 id="policy">Policy</h2>
        <p>
          Flap is for legitimate business and application email from domains you own or are authorized to manage.
          Purchased, scraped, harvested, and unsolicited lists are prohibited. See{" "}
          <a href="/acceptable-use" onClick={(e) => { e.preventDefault(); go("/acceptable-use"); }}>
            Acceptable use
          </a>{" "}
          and{" "}
          <a href="/abuse" onClick={(e) => { e.preventDefault(); go("/abuse"); }}>
            abuse reporting
          </a>
          .
        </p>
      </DocsPage>
    </DocsShell>
  );
}
