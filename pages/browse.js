// pages/browse.js
// Build 36.30_2025-08-23
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import QuickColors from "../components/QuickColors";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

// Categories per your baseline
const CATEGORIES = [
  "Blebs (clear to brown)",
  "Biofilm",
  "Fiber Bundles",
  "Fibers",
  "Hexagons",
  "Crystalline Structures",
  "Feathers",
  "Miscellaneous",
  "Hairs",
  "Skin",
  "Wounds",
];

// Quick color sets
const BLEB_COLORS = [
  { label: "Clear/White", value: "Clear" },
  { label: "Yellow", value: "Yellow" },
  { label: "Orange", value: "Orange" },
  { label: "Red", value: "Red" },
  { label: "Brown", value: "Brown" },
];

const BUNDLE_COLORS = ["white/clear", "blue", "black", "red", "other"];
const FIBER_COLORS = ["white/clear", "blue", "black", "red", "other"];

function slugForCategory(cat) {
  // Dedicated Blebs route per baseline
  if (cat === "Blebs (clear to brown)") return "clear_to_brown_blebs";
  // Underscore slug for others
  return cat.toLowerCase().replace(/\s+/g, "_");
}

// Simple styles
const pageStyle = { maxWidth: 980, margin: "0 auto", padding: "16px" };
const h1Style = { fontSize: 22, fontWeight: 700, margin: 0 };
const header = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};
const statusStyle = { fontSize: 13, color: "#555", margin: "8px 0 12px" };
const list = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 };
const card = { border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", background: "#fff" };
const catTitle = { fontSize: 16, fontWeight: 700, marginBottom: 6 };
const countStyle = { fontSize: 12, color: "#444", marginBottom: 10 };
const linkRow = { display: "flex", gap: 8, flexWrap: "wrap" };
const linkBtn = {
  fontSize: 12,
  border: "1px solid #ccc",
  borderRadius: 6,
  padding: "6px 10px",
  background: "#fff",
  textDecoration: "none",
  color: "#111",
};

export default function BrowsePage() {
  const router = useRouter();
  const [userPresent, setUserPresent] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let on = true;
    (async () => {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      if (!on) return;
      setUserPresent(!!authData?.user);

      // fetch counts per category (RLS ensures own rows)
      setStatus("Loading…");
      const results = await Promise.all(
        CATEGORIES.map(async (cat) => {
          const { count, error } = await supabase
            .from("image_metadata")
            .select("id", { count: "exact", head: true })
            .eq("category", cat);
          return { cat, count: error ? 0 : (count || 0) };
        })
      );
      if (!on) return;
      const map = {};
      results.forEach(({ cat, count }) => (map[cat] = count));
      setCounts(map);
      setStatus("");
    })();
    return () => { on = false; };
  }, []);

  // Build quick color bars
  const blebsBar = (
    <QuickColors
      baseHref="/category/clear_to_brown_blebs"
      label="Blebs colors"
      colors={BLEB_COLORS}
      activeColor={router.query?.color || ""}
    />
  );
  const bundlesBar = (
    <QuickColors
      baseHref="/category/fiber_bundles"
      label="Fiber Bundles colors"
      colors={BUNDLE_COLORS}
      activeColor={router.query?.color || ""}
    />
  );
  const fibersBar = (
    <QuickColors
      baseHref="/category/fibers"
      label="Fibers colors"
      colors={FIBER_COLORS}
      activeColor={router.query?.color || ""}
    />
  );

  const statusText = userPresent === false
    ? "Not signed in. Your items may be empty."
    : status;

  return (
    <main id="main" style={pageStyle}>
      <div style={header}>
        <h1 style={h1Style}>Browse categories</h1>
        <div style={{ fontSize: 12, color: "#666" }}>
          {Object.values(counts).reduce((a, b) => a + (b || 0), 0)} total
        </div>
      </div>

      {/* Quick color bars at the top (Blebs + Fiber Bundles + Fibers) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {blebsBar}
        {bundlesBar}
        {fibersBar}
      </div>

      <p aria-live="polite" style={statusStyle}>{statusText}</p>

      <section aria-labelledby="catlist-heading">
        <h2 id="catlist-heading" style={{ position: "absolute", left: -9999, top: "auto" }}>
          Categories
        </h2>
        <ul style={list}>
          {CATEGORIES.map((cat) => {
            const slug = slugForCategory(cat);
            const href = `/category/${slug}`;
            const count = counts[cat] ?? 0;

            // Show small, relevant per-category color links only for the three groups
            const quickLinks = (cat === "Blebs (clear to brown)" || cat === "Fiber Bundles" || cat === "Fibers");

            return (
              <li key={cat} style={card}>
                <div style={catTitle}>{cat}</div>
                <div style={countStyle}>{count} item{count === 1 ? "" : "s"}</div>
                <div style={linkRow}>
                  <Link href={href} legacyBehavior><a style={linkBtn} aria-label={`Open ${cat}`}>Open</a></Link>
                  {quickLinks && (
                    <Link href={
                      cat === "Blebs (clear to brown)"
                        ? "/category/clear_to_brown_blebs?color=Clear"
                        : cat === "Fiber Bundles"
                        ? "/category/fiber_bundles?color=white%2Fclear"
                        : "/category/fibers?color=white%2Fclear"
                    } legacyBehavior>
                      <a style={linkBtn} aria-label="Quick: white/clear">white/clear</a>
                    </Link>
                  )}
                  {quickLinks && (cat !== "Blebs (clear to brown)") && (
                    <>
                      <Link href={`/category/${slug}?color=blue`} legacyBehavior><a style={linkBtn}>blue</a></Link>
                      <Link href={`/category/${slug}?color=black`} legacyBehavior><a style={linkBtn}>black</a></Link>
                      <Link href={`/category/${slug}?color=red`} legacyBehavior><a style={linkBtn}>red</a></Link>
                      <Link href={`/category/${slug}?color=other`} legacyBehavior><a style={linkBtn}>other</a></Link>
                    </>
                  )}
                  {quickLinks && cat === "Blebs (clear to brown)" && (
                    <>
                      <Link href="/category/clear_to_brown_blebs?color=Yellow" legacyBehavior><a style={linkBtn}>Yellow</a></Link>
                      <Link href="/category/clear_to_brown_blebs?color=Orange" legacyBehavior><a style={linkBtn}>Orange</a></Link>
                      <Link href="/category/clear_to_brown_blebs?color=Red" legacyBehavior><a style={linkBtn}>Red</a></Link>
                      <Link href="/category/clear_to_brown_blebs?color=Brown" legacyBehavior><a style={linkBtn}>Brown</a></Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}






