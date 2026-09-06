import { MARKETING, SITE_URL } from "../content/marketing";
import { getRegistryEntry } from "../content/seo-registry";
import {
  articleLd,
  breadcrumbLd,
  entityGraphLd,
  faqPageLd,
  howToLd,
  organizationLd,
  personFounderLd,
  softwareApplicationLd,
  webApplicationToolLd,
  webPageLd,
  websiteLd,
} from "./jsonld";

export {
  articleLd,
  breadcrumbLd,
  entityGraphLd,
  faqPageLd,
  howToLd,
  organizationLd,
  personFounderLd,
  softwareApplicationLd,
  webApplicationToolLd,
  webPageLd,
  websiteLd,
};

export function setPageMeta(opts: {
  title: string;
  description: string;
  path?: string;
  type?: string;
  image?: string;
}) {
  const path = opts.path || "/";
  const url = path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  const reg = getRegistryEntry(path);
  const imagePath = opts.image || reg?.ogImagePath || "/og.png";
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SITE_URL}${imagePath}`;
  const ogType = opts.type || reg?.ogType || "website";

  document.title = opts.title;

  upsertMeta("name", "description", opts.description);
  upsertMeta("property", "og:title", opts.title);
  upsertMeta("property", "og:description", opts.description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", ogType);
  upsertMeta("property", "og:site_name", "Flap");
  upsertMeta("property", "og:image", imageUrl);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:image:type", imagePath.endsWith(".svg") ? "image/svg+xml" : "image/png");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", opts.title);
  upsertMeta("name", "twitter:description", opts.description);
  upsertMeta("name", "twitter:image", imageUrl);

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

const JSON_LD_IDS = ["flap-jsonld", "flap-webpage", "flap-software", "flap-tool", "flap-faq", "flap-howto", "flap-article"];

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

export function setJsonLdBundle(data: Record<string, unknown> | Record<string, unknown>[]) {
  setJsonLd("flap-jsonld", data);
}

export function clearJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export function clearJsonLdHelpers() {
  for (const id of JSON_LD_IDS) clearJsonLd(id);
}

/** @deprecated Prefer softwareApplicationLd from jsonld (offers from PLANS). */
export function softwareApplicationLdLegacy() {
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

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function captureUtmFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 120);
  }
  if (!Object.keys(utm).length) return;
  try {
    sessionStorage.setItem("flap_utm", JSON.stringify(utm));
  } catch {
    /* ignore */
  }
}

export function getStoredUtm(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem("flap_utm");
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}
