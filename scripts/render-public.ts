/** Render the actual public React pages so crawlers and readers receive the same copy. */
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import Landing from '../src/pages/Landing';
import PricingPage from '../src/pages/PricingPage';
import BlogIndex from '../src/pages/BlogIndex';
import BlogPost from '../src/pages/BlogPost';
import SeoLanding from '../src/pages/SeoLanding';
import GuidePage from '../src/pages/GuidePage';
import DnsToolPage from '../src/pages/DnsToolPage';
import CalculatorPage from '../src/pages/CalculatorPage';
import ToolsIndex from '../src/pages/ToolsIndex';
import DocsIndexPage from '../src/pages/DocsIndexPage';
import DocsGettingStartedPage from '../src/pages/DocsGettingStartedPage';
import DocsConceptsPage from '../src/pages/DocsConceptsPage';
import DocsWebhooksPage from '../src/pages/DocsWebhooksPage';
import DocsApiPage from '../src/pages/DocsApiPage';
import GuidesIndexPage from '../src/pages/GuidesIndexPage';
import AboutPage from '../src/pages/AboutPage';
import SecurityPage from '../src/pages/SecurityPage';
import MigratePage from '../src/pages/MigratePage';
import WhyNotSesPage from '../src/pages/WhyNotSesPage';
import DemoPage from '../src/pages/DemoPage';
import ChangelogPage from '../src/pages/ChangelogPage';
import SupportPage from '../src/pages/SupportPage';
import StatusPage from '../src/pages/StatusPage';
import HubPage from '../src/pages/HubPage';
import HubIndexPage from '../src/pages/HubIndexPage';
import ResearchPage from '../src/pages/ResearchPage';
import Legal from '../src/pages/Legal';
import { SEO_PAGE_DEFS } from '../src/content/seo-pages';

const staticPages: Record<string, ComponentType> = {
  '/': Landing, '/pricing': PricingPage, '/blog': BlogIndex, '/tools': ToolsIndex,
  '/docs': DocsIndexPage, '/docs/getting-started': DocsGettingStartedPage,
  '/docs/concepts': DocsConceptsPage, '/docs/webhooks': DocsWebhooksPage,
  '/docs/api': DocsApiPage, '/guides': GuidesIndexPage, '/about': AboutPage,
  '/security': SecurityPage, '/migrate': MigratePage, '/why-not-amazon-ses': WhyNotSesPage,
  '/demo': DemoPage, '/changelog': ChangelogPage,
  '/support': SupportPage, '/status': StatusPage,
};
export function renderPublicPage(path: string): string {
  let element;
  if (staticPages[path]) element = createElement(staticPages[path]);
  else if (path === '/terms' || path === '/privacy' || path === '/billing-terms') element = createElement(Legal, { doc: path === '/terms' ? 'terms' : path === '/privacy' ? 'privacy' : 'billing' });
  else if (path === '/for' || path === '/vs') element = createElement(HubIndexPage, { kind: path === '/for' ? 'for' : 'vs' });
  else if (path.startsWith('/for/') || path.startsWith('/vs/')) element = createElement(HubPage, { path });
  else if (path === '/research') element = createElement(ResearchPage, { path });
  else if (path.startsWith('/blog/')) element = createElement(BlogPost, { path });
  else if (path.startsWith('/guides/')) element = createElement(GuidePage, { path });
  else if (path === '/tools/google-workspace-cost-calculator' || path === '/tools/flap-vs-workspace-share') element = createElement(CalculatorPage, { share: path.endsWith('flap-vs-workspace-share') });
  else if (path.startsWith('/tools/')) element = createElement(DnsToolPage, { path });
  else if (SEO_PAGE_DEFS[path]) element = createElement(SeoLanding, { path });
  else throw new Error(`No public renderer for ${path}`);
  return renderToString(element);
}
