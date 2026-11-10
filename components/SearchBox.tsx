export function SearchBox({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form className="search" action="/search" method="get" role="search">
      <label htmlFor="q" className="visually-hidden" style={{ position: "absolute", left: "-9999px" }}>
        Search products
      </label>
      <input
        id="q"
        name="q"
        type="search"
        placeholder="Search products, brands or shops"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <button type="submit">Search</button>
    </form>
  );
}
