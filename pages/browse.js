// pages/browse.js
// The Scope of Morgellons — Browse by Category (with counts + Bleb color quick links)
// Build: 36.6_2025-08-19

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = auth?.user || null;
      setUser(u);
      if (u) {
        await loadCounts(u.id);
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  async function loadCounts(userId) {
    setLoading(true);
    const pairs = await Promise.all(
      CATEGORIES.map(async (c) => {
        const { count, error } = await supabase
          .from("image_metadata")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("category", c.value);
        if (error) return [c.value, null];
        return [c.value, count ?? 0];
      })
    );
    setCounts(Object.fromEntries(pairs));
    setLoading(false);
  }

  const CountBadge = ({ value }) => {
    const bg = "#f3f4f6";
    const color = "#374151";
    return (
      <span
        style={{
          display: "inline-block",
          minWidth: 22,
          textAlign: "center",
          padding: "2px 6px",
          borderRadius: 999,
          background: bg,
          color,
          fontSize: 12,
          border: "1px solid #e5e7eb",
        }}
        aria-label="Item count"
      >
        {value ?? "–"}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 780, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Browse by Category</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.6_2025-08-19</div>
      </header>

      <nav style={{ marginTop: 8 }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>← Back to Profile</Link>
      </nav>

      {!user ? (
        <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Sign in to see your per-category counts.
        </p>
      ) : loading ? (
        <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Loading counts…</p>
      ) : null}

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
              {user ? <CountBadge value={counts[c.value]} /> : <CountBadge value={null} />}
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
          Counts reflect your own uploads (RLS enforced).
        </p>
      </section>
    </div>
  );
}

