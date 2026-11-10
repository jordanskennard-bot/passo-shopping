"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <div className="eyebrow">Price comparison</div>
      <h1>We are loading the catalogue</h1>
      <p className="lede">
        Prices are not available right now. Please try again shortly. Company and contact details are below.
      </p>
      <p>
        <button className="go" onClick={() => reset()} style={{ background: "none", cursor: "pointer" }}>
          Try again
        </button>
      </p>
    </>
  );
}
