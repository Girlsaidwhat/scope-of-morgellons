// pages/browse.js
// The Scope of Morgellons — Browse by Category (with Bleb color quick links)
// Build: 36.4h2_2025-08-18

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

const BLEB_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];

export default function BrowsePage() {
  return (
    <div style={{ maxWidth: 780, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Browse by Category</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.4h2_2025-08-18</div>
      </header>

      <nav style={{ marginTop: 8 }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>← Back to Profile</Link>
      </nav>

      <section style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {CATEGORIES.filter(c => c.value !== "miscellaneous").map((c) => (
          <div key={c.value} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Link
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
            </div>

            {/* Quick color links for Blebs */}
            {c.value === "clear_to_brown_blebs" ? (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BLEB_COLORS.map((col) => (
                  <Link
                    key={col}
                    href={`/category/clear_to_brown_blebs?color=${encodeURIComponent(col)}`}
                    style={{
                      display: "inline-block",
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#ecfeff",
                      fontSize: 12,
                      color: "#155e75",
                      textDecoration: "none",
                    }}
                    title={`Filter Blebs by ${col}`}
                  >
                    {col}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <p style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
          Tip: Blebs have quick color filters now.
        </p>
      </section>
    </div>
  );
}
