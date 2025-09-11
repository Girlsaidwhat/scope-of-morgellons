// pages/index.js — Stability Hotfix (minimal, compiles cleanly)
import Link from "next/link";

const INDEX_BUILD = "hotfix-001";

export default function HomePage() {
  return (
    <main
      id="main"
      data-index-build={INDEX_BUILD}
      tabIndex={-1}
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: 24,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
      }}
    >
      {/* Build badge so we can confirm the exact version rendering */}
      <div aria-hidden="true" style={{ textAlign: "right", marginBottom: 8 }}>
        <span
          data-build-badge
          style={{
            fontSize: 11,
            opacity: 0.8,
            border: "1px solid #e5e7eb",
            padding: "2px 6px",
            borderRadius: 6,
          }}
        >
          BUILD {INDEX_BUILD}
        </span>
      </div>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Your Profile</h1>
        <nav aria-label="Top actions" style={{ display: "flex", gap: 12 }}>
          <Link href="/upload" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to Uploads
          </Link>
          <Link href="/questionnaire" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to My Story
          </Link>
          <Link href="/gallery" style={{ textDecoration: "none", fontWeight: 600 }}>
            Your Gallery
          </Link>
        </nav>
      </header>

      <div
        role="region"
        aria-label="Profile status"
        style={{
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          margin: "8px 0 16px",
          fontSize: 14,
        }}
      >
        Welcome back. This is a minimal, stable version to restore Production.
        We’ll layer your richer Profile UI back in next, in small, safe steps.
      </div>

      <section aria-label="Next steps" style={{ fontSize: 14, opacity: 0.85 }}>
        <ul>
          <li>
            Verify this page renders on Production (see link below). The build badge should
            read <code>{INDEX_BUILD}</code>.
          </li>
          <li>
            Once confirmed, we’ll add back profile fields, CSV export, and gallery UI in
            small commits.
          </li>
        </ul>
      </section>

      <style jsx global>{`
        [data-build-badge] {
          user-select: none;
        }
        main[data-index-build="${INDEX_BUILD}"] a:hover {
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
