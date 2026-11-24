import { currentCountry } from "@/lib/request-country";
import { localPath } from "@/lib/countries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCategories } from "@/lib/catalogue";
import { Results, readParams } from "@/components/Results";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function find(slug: string, country: string) {
  return (await listCategories(country)).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await find((await params).slug, (await currentCountry()).code);
  return { title: cat ? `${cat.name} prices` : "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await currentCountry();
  const cat = await find(slug, c.code);
  if (!cat) notFound();
  const query = { ...readParams(await searchParams), category: slug };
  return (
    <>
      <div className="eyebrow">Category</div>
      <h1>{cat.name}</h1>
      <Results base={localPath(c, `/category/${slug}`)} params={query} country={c} />
    </>
  );
}
