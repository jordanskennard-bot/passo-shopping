import type { MetadataRoute } from "next";
import { site } from "@/lib/config";
import { listCategories } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/merchants", "/about", "/contact", "/how-we-rank"].map((p) => ({ url: `${site.url}${p}` }));
  try {
    const cats = await listCategories();
    return [...pages, ...cats.map((c) => ({ url: `${site.url}/category/${c.slug}` }))];
  } catch {
    return pages;
  }
}
