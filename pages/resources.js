// pages/resources.js
import Link from "next/link";

export default function ResourcesPage() {
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Link href="/?explore=1" style={{ textDecoration: "none" }} title="Back to landing">
          ← Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>Resources</h1>
      </header>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Curated links, reading lists, and materials for researchers and community members will be collected here.
      </p>
    </main>
  );
}
