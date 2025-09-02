// pages/about.js
import Link from "next/link";

export default function AboutPage() {
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Link href="/?explore=1" style={{ textDecoration: "none" }} title="Back to landing">
          ← Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>About</h1>
      </header>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        The Scope of Morgellons is a community project to collect, organize, and study anonymized images by category.
        This page will expand with a clear description of methods, goals, and participation guidelines.
      </p>
    </main>
  );
}
