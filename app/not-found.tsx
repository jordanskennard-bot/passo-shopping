import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p className="lede">This product may no longer be sold by any shop we compare.</p>
      <p>
        <Link href="/">Search the catalogue →</Link>
      </p>
    </>
  );
}
