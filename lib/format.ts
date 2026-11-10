export function money(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "Not stated";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function delivery(pence: number | null): string {
  if (pence === null) return "Check with shop";
  if (pence === 0) return "Free";
  return money(pence);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}
