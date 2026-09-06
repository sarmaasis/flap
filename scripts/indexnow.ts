/**
 * Submit sitemap URLs to IndexNow (Bing / Yandex / compatible engines).
 * Key file must remain public: public/flap-indexnow-7c4e9a2b1d8f.txt
 */
import { buildSitemapEntries, absoluteUrl } from "../src/content/sitemap.ts";

const KEY = "flap-indexnow-7c4e9a2b1d8f";
const HOST = "useflap.online";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

async function main() {
  const urls = buildSitemapEntries().map((e) => absoluteUrl(e.path));
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow ${res.status} — submitted ${urls.length} URLs`);
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
}

main();
