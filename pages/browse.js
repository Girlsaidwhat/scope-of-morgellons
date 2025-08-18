// pages/browse.js
// The Scope of Morgellons — Browse by Category
// Build: 36.4b_2025-08-18

import Link from "next/link";

const CATEGORIES = [
  { value: "biofilm", label: "Biofilm" },
  { value: "clear_to_brown_blebs", label: 'Clear--Brown "Blebs"' },
  { value: "fiber_bundles", label: "Fiber Bundles" },
  { value: "fibers", label: "Fibers" },
  { value: "hexagons", label: "Hexagons" },
  { value: "crystalline_structures", label: "Crystalline Structures" },
  { value: "feathers", label: "Feathers" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

export default function BrowsePage() {
  return (
    <div style={{ maxWidth: 780, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Browse by Category</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.4b_2025-08-18</div>
      </header>

      <nav style={{ marginTop: 8 }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>← Back to Profile</Link>
      </nav>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.filter(c => c.value !== "miscellaneous").map((c) => (
            <Link
              key={c.value}
              href={`/category/${c.value}`}
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 13,
                color: "#111827",
                textDecoration: "none",
              }}
              title={`View ${c.label}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Links will work after we add the category pages.
        </p>
      </section>
    </div>
  );
}
