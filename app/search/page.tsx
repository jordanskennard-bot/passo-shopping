import type { Metadata } from "next";
import { Results, readParams } from "@/components/Results";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = readParams(await searchParams);
  return { title: p.q ? `Prices for "${p.q}"` : "All products", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = readParams(await searchParams);
  return (
    <>
      <h1>{params.q ? `Results for “${params.q}”` : "All products"}</h1>
      <Results base="/search" params={params} />
    </>
  );
}
