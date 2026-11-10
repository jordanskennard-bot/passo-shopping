export function Prose({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <article className="prose">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {children}
    </article>
  );
}
