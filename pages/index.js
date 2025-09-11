// pages/index.js
// Minimal, safe render to verify public image serving and eliminate runtime errors.
// Shows a header and a fixed-size (315x429) aside image loaded from /public.
// Build badge: idx-36.711

const INDEX_BUILD = "idx-36.711";

export default function HomePage() {
  return (
    <main
      id="main"
      data-index-build={INDEX_BUILD}
      style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Welcome to Your Profile</h1>

        {/* Right-side image: exact 315x429, contain */}
        <div
          style={{
            width: 315,
            height: 429,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/story_placeholder-idx36704.jpg"
            alt="Fill in your story"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </div>
      </header>

      <p style={{ marginTop: 8, opacity: 0.9 }}>
        Minimal verification build (<code>{INDEX_BUILD}</code>). Once confirmed working in Production,
        we’ll restore the full Profile (form + gallery) with this aside image.
      </p>

      {/* Minimal global polish for buttons/inputs if any are added later */}
      <style jsx global>{`
        main[data-index-build="${INDEX_BUILD}"] button,
        main[data-index-build="${INDEX_BUILD}"] input,
        main[data-index-build="${INDEX_BUILD}"] select {
          border-radius: 8px;
        }
      `}</style>
    </main>
  );
}
