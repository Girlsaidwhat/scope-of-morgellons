// pages/browse.js
// Build 36.13_2025-08-20
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

const CATEGORIES = [
  { label: "Blebs (clear to brown)", slug: "clear_to_brown_blebs" },
  { label: "Biofilm", slug: "biofilm" },
  { label: "Fiber Bundles", slug: "fiber_bundles" },
  { label: "Fibers", slug: "fibers" },
  { label: "Hexagons", slug: "hexagons" },
  { label: "Crystalline Structures", slug: "crystalline_structures" },
  { label: "Feathers", slug: "feathers" },
  { label: "Miscellaneous", slug: "miscellaneous" },
  { label: "Hairs", slug: "hairs" },
  { label: "Skin", slug: "skin" },
  { label: "Wounds", slug: "wounds" },
];

const BLEB_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];
const FIBER_COMMON_COLORS = ["white/clear", "blue", "black", "red", "other"];

// Inline styles (no framework needed)
const pageStyle = { maxWidth: 880, margin: "0 auto", padding: "16px" };
const h1Style = { fontSize: "28px", fontWeight: 700, marginBottom: "10px" };
const h2Style = { fontSize: "18px", fontWeight: 600, margin: "16px 0 8px" };
const h3Style = { fontSize: "14px", fontWeight: 600, margin: "8px 0 6px" };
const statusStyle = { fontSize: "13px", color: "#555", marginBottom: "12px" };
const listWrapStyle = { border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" };
const listItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderTop: "1px solid #eee",
};
const firstListItemStyle = { ...listItemStyle, borderTop: "none" };
const chipRowStyle = { display: "flex", flexWrap: "wrap", marginTop: 4 };
const chipAStyle = {
  display: "inline-block",
  border: "1px solid #ccc",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  color: "#111",
  background: "#fff",
  textDecoration: "none",
  marginRight: 8,
  marginBottom: 8,
};
const catLinkAStyle = { color: "#0b5fff", textDecoration: "none", fontWeight: 500 };

export default function Browse() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [signedIn, setSignedIn] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!supabase) return;
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!isMounted) return;
      setSignedIn(!!user);

      const { data, error } = await supabase
        .from("image_metadata")
        .select("id, category"); // RLS: only your rows

      if (!isMounted) return;
      if (error) {
        console.error("browse fetch error:", error);
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map(CATEGORIES.map((c) => [c.label, 0]));
    for (const r of rows) {
      if (map.has(r.category)) map.set(r.category, (map.get(r.category) || 0) + 1);
    }
    return map;
  }, [rows]);

  const Chip = ({ href, label }) => (
    <Link href={href} legacyBehavior>
      <a aria-label={label} style={chipAStyle}>{label}</a>
    </Link>
  );

  const CatLink = ({ href, label }) => (
    <Link href={href} legacyBehavior>
      <a aria-label={`Open ${label} category`} style={catLinkAStyle}>{label}</a>
    </Link>
  );

  return (
    <main id="main" style={pageStyle}>
      <h1 style={h1Style}>Browse</h1>

      <p aria-live="polite" id="browse-status" style={statusStyle}>
        {loading
          ? "Loading your category counts…"
          : signedIn
          ? "Showing your categories."
          : "Not signed in. Category counts may be empty."}
      </p>

      {/* Quick color links */}
      <section aria-labelledby="quick-colors-heading" role="navigation" style={{ marginBottom: 16 }}>
        <h2 id="quick-colors-heading" style={h2Style}>Quick colors</h2>

        {/* Blebs quick links */}
        <div style={{ marginBottom: 10 }}>
          <h3 style={h3Style}>Blebs (clear to brown)</h3>
          <div style={chipRowStyle}>
            {BLEB_COLORS.map((c) => (
              <Chip
                key={`blebs-${c}`}
                href={`/category/clear_to_brown_blebs?color=${encodeURIComponent(c)}`}
                label={c}
              />
            ))}
          </div>
        </div>

        {/* Fiber Bundles quick links */}
        <div style={{ marginBottom: 10 }}>
          <h3 style={h3Style}>Fiber Bundles</h3>
          <div style={chipRowStyle}>
            {FIBER_COMMON_COLORS.map((c) => (
              <Chip
                key={`bundles-${c}`}
                href={`/category/fiber_bundles?color=${encodeURIComponent(c)}`}
                label={c}
              />
            ))}
          </div>
        </div>

        {/* Fibers quick links */}
        <div>
          <h3 style={h3Style}>Fibers</h3>
          <div style={chipRowStyle}>
            {FIBER_COMMON_COLORS.map((c) => (
              <Chip
                key={`fibers-${c}`}
                href={`/category/fibers?color=${encodeURIComponent(c)}`}
                label={c}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Category list with per-user counts */}
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" style={h2Style}>Your categories</h2>
        <ul style={listWrapStyle}>
          {CATEGORIES.map((cat, idx) => {
            const count = counts.get(cat.label) ?? 0;
            const itemStyle = idx === 0 ? firstListItemStyle : listItemStyle;
            return (
              <li key={cat.slug} style={itemStyle}>
                <CatLink href={`/category/${cat.slug}`} label={cat.label} />
                <span aria-label={`${cat.label} count`} style={{ fontSize: 13 }}>{count}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}





