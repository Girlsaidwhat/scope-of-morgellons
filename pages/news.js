// pages/news.js
import Link from "next/link";

export default function NewsPage() {
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Link href="/?explore=1" style={{ textDecoration: "none" }} title="Back to landing">
          ← Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>News</h1>
      </header>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Updates and announcements will appear here. For now, this is a placeholder page.
      </p>
    </main>
  );
}
