import { MARKETING, SITE_URL } from "../content/marketing";

export function setPageMeta(opts: {
  title: string;
  description: string;
  path?: string;
  type?: string;
}) {
  const url = `${SITE_URL}${opts.path || "/"}`;
  document.title = opts.title;

  upsertMeta("name", "description", opts.description);
  upsertMeta("property", "og:title", opts.title);
  upsertMeta("property", "og:description", opts.description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", opts.type || "website");
  upsertMeta("property", "og:site_name", "Flap");
  upsertMeta("property", "og:image", `${SITE_URL}/og.png`);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", opts.title);
  upsertMeta("name", "twitter:description", opts.description);
  upsertMeta("name", "twitter:image", `${SITE_URL}/og.png`);

  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function setJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function clearJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export function softwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: MARKETING.product_name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: MARKETING.short_description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free plan available; paid plans from $7/month",
    },
    publisher: {
      "@type": "Organization",
      name: "Flap",
      url: SITE_URL,
    },
  };
}

export function webPageLd(opts: {
  path: string;
  title: string;
  description: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.title,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    isPartOf: { "@type": "WebSite", name: "Flap", url: SITE_URL },
    about: { "@type": "SoftwareApplication", name: "Flap", url: SITE_URL },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

export function articleLd(opts: {
  path: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: { "@type": "Organization", name: "Flap", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Flap", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
    about: [
      { "@type": "Thing", name: "Flap" },
      { "@type": "Thing", name: "custom domain email" },
      { "@type": "Thing", name: "useflap.online" },
    ],
  };
}

export function faqPageLd(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function howToLd(opts: {
  name: string;
  description: string;
  steps: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

export function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;
  const clean = ref.trim().toLowerCase().slice(0, 32);
  if (!/^[a-z0-9_-]+$/.test(clean)) return;
  document.cookie = `flap_ref=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  try {
    localStorage.setItem("flap_ref", clean);
  } catch {
    /* ignore */
  }
}

export function getStoredReferral(): string | null {
  try {
    const fromLs = localStorage.getItem("flap_ref");
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|;\s*)flap_ref=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
