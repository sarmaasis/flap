/**
 * Shared, testable JSON-LD builders. Offers and limits come from shared/plans.ts.
 */
import { PLANS, PLAN_ORDER } from "../../shared/plans";
import {
  FOUNDER,
  MAIL_ARCHITECTURE,
  ORGANIZATION,
  PERSON_FOUNDER,
  PRODUCT_NAME,
  SITE_URL,
  SOFTWARE_APP,
  SUPPORT_EMAIL,
  WEBSITE,
} from "../../shared/product-facts";
import { MARKETING } from "../content/marketing";

export function organizationLd(): Record<string, unknown> {
  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": ORGANIZATION.id,
    name: ORGANIZATION.name,
    alternateName: ORGANIZATION.alternateName,
    description: ORGANIZATION.description,
    url: ORGANIZATION.url,
    email: ORGANIZATION.email,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}${ORGANIZATION.logoPath}`,
    },
  };
  if (ORGANIZATION.sameAs.length) org.sameAs = [...ORGANIZATION.sameAs];
  return org;
}

export function websiteLd(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE.id,
    name: WEBSITE.name,
    url: WEBSITE.url,
    publisher: { "@id": ORGANIZATION.id },
  };
}

export function personFounderLd(): Record<string, unknown> {
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": PERSON_FOUNDER.id,
    name: PERSON_FOUNDER.name,
    jobTitle: PERSON_FOUNDER.jobTitle,
    url: PERSON_FOUNDER.url,
    worksFor: { "@id": ORGANIZATION.id },
  };
  if (PERSON_FOUNDER.sameAs.length) person.sameAs = [...PERSON_FOUNDER.sameAs];
  return person;
}

export function softwareApplicationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_APP.id,
    name: PRODUCT_NAME,
    alternateName: ORGANIZATION.alternateName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: MARKETING.short_description,
    offers: PLAN_ORDER.filter((id) => id !== "free").map((id) => ({
      "@type": "Offer",
      name: PLANS[id].name,
      price: String(PLANS[id].price_monthly),
      priceCurrency: "USD",
      description: `${PLANS[id].limits.domains} domains · ${PLANS[id].limits.send_per_month} sends/mo`,
    })),
    publisher: { "@id": ORGANIZATION.id },
  };
}

export function webPageLd(opts: {
  path: string;
  title: string;
  description: string;
  dateModified?: string;
  datePublished?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${opts.path}#webpage`,
    name: opts.title,
    description: opts.description,
    url: `${SITE_URL}${opts.path === "/" ? "/" : opts.path}`,
    isPartOf: { "@id": WEBSITE.id },
    about: { "@id": SOFTWARE_APP.id },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
  };
}

export function articleLd(opts: {
  path: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}): Record<string, unknown> {
  const url = `${SITE_URL}${opts.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: opts.title,
    description: opts.description,
    url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: { "@id": PERSON_FOUNDER.id },
    publisher: { "@id": ORGANIZATION.id },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${url}#webpage` },
    image: opts.image || `${SITE_URL}/og.png`,
    about: [
      { "@type": "Thing", name: "Flap" },
      { "@type": "Thing", name: "custom domain email" },
    ],
  };
}

export function faqPageLd(faqs: Array<{ q: string; a: string }>): Record<string, unknown> {
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
}): Record<string, unknown> {
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

export function breadcrumbLd(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === "/" ? "/" : item.path}`,
    })),
  };
}

export function webApplicationToolLd(opts: {
  name: string;
  path: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${opts.path}`,
    description: opts.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@id": ORGANIZATION.id },
  };
}

/** Graph wrapper with stable entity nodes — use once per page head. */
export function entityGraphLd(
  extras: Record<string, unknown>[] = [],
): Record<string, unknown> {
  const strip = (obj: Record<string, unknown>) => {
    const { ["@context"]: _c, ...rest } = obj;
    return rest;
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(),
      websiteLd(),
      personFounderLd(),
      ...extras.map(strip),
    ],
  };
}

export function aboutPageFacts() {
  return {
    product: PRODUCT_NAME,
    founder: FOUNDER,
    supportEmail: SUPPORT_EMAIL,
    architecture: MAIL_ARCHITECTURE,
    siteUrl: SITE_URL,
  };
}
