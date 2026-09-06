/**
 * Path-only registry for App routing.
 * Keep in sync with BLOG_POSTS in blog.ts (full bodies stay out of the main chunk).
 */
export const BLOG_PATHS = [
  "/blog/custom-domain-email-without-google-workspace",
  "/blog/cost-of-google-workspace-multiple-domains",
  "/blog/mx-spf-dmarc-setup-checklist",
  "/blog/self-host-vs-hosted-email-startups",
  "/blog/catchall-aliases-indie-founders",
] as const;
