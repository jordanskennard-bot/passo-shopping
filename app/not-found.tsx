import Link from "next/link";
import { currentCountry } from "@/lib/request-country";
import { localPath } from "@/lib/countries";

export default async function NotFound() {
  const c = await currentCountry();
  return (
    <>
      <h1>Page not found</h1>
      <p className="lede">This product may no longer be sold by any shop we compare.</p>
      <p>
        <Link href={localPath(c, "/")}>Search the catalogue →</Link>
      </p>
    </>
  );
}
