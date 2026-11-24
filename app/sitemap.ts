import type { MetadataRoute } from "next";
import { rules, site } from "@/lib/config";
import { enabledCountries, localPath } from "@/lib/countries";
import { catalogueStats, listCategories } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

const PAGES = ["/", "/merchants", "/about", "/for-shops", "/contact", "/how-we-rank"];

/** The UK always; other countries once they meet Google's merchant minimum. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [];
  for (const c of enabledCountries()) {
    try {
      if (c.prefix && (await catalogueStats(c.code)).merchants < rules.merchantsRequired) continue;
      const cats = await listCategories(c.code);
      for (const p of [...PAGES, ...cats.map((x) => `/category/${x.slug}`)]) {
        out.push({ url: `${site.url}${localPath(c, p) === "/" ? "" : localPath(c, p)}` });
      }
    } catch {
      if (!c.prefix) out.push(...PAGES.map((p) => ({ url: `${site.url}${p === "/" ? "" : p}` })));
    }
  }
  return out;
}
