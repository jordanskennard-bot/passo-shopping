import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCategories } from "@/lib/catalogue";
import { Results, readParams } from "@/components/Results";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function find(slug: string) {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await find((await params).slug);
  return { title: cat ? `${cat.name} prices` : "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = await find(slug);
  if (!cat) notFound();
  const query = { ...readParams(await searchParams), category: slug };
  return (
    <>
      <div className="eyebrow">Category</div>
      <h1>{cat.name}</h1>
      <Results base={`/category/${slug}`} params={query} />
    </>
  );
}
