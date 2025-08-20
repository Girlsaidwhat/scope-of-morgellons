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

// Color sets (exact values used elsewhere in your app)
// Blebs colors are capitalized; Fiber Bundles/Fibers are lower-case.
const BLEB_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];
const FIBER_COMMON_COLORS = ["white/clear", "blue", "black", "red", "other"];

export default function Browse() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [signedIn, setSignedIn] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      setSignedIn(!!user);

      // RLS ensures we only see our own rows
      const { data, error } = await supabase
        .from("image_metadata")
        .select("id, category");

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
      if (map.has(r.category)) map.set(r.category, map.get(r.category) + 1);
    }
    return map;
  }, [rows]);

  return (
    <main id="main" className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Browse</h1>

      {/* Status line */}
      <p
        aria-live="polite"
        className="text-sm text-gray-600 mb-4"
        id="browse-status"
      >
        {loading
          ? "Loading your category counts…"
          : signedIn
          ? "Showing your categories."
          : "Not signed in. Category counts may be empty."}
      </p>

      {/* Quick color links */}
      <section
        className="mb-6"
        aria-labelledby="quick-colors-heading"
        role="navigation"
      >
        <h2 id="quick-colors-heading" className="text-lg font-medium mb-2">
          Quick colors
        </h2>

        {/* Blebs quick links (existing parity) */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold mb-1">
            Blebs (clear to brown)
          </h3>
          <div className="flex flex-wrap gap-2">
            {BLEB_COLORS.map((color) => (
              <Link
                key={color}
                href={`/category/clear_to_brown_blebs?color=${encodeURIComponent(
                  color
                )}`}
                className="inline-block rounded-full border px-3 py-1 text-sm hover:underline"
                aria-label={`Blebs color ${color}`}
              >
                {color}
              </Link>
            ))}
          </div>
        </div>

        {/* NEW: Fiber Bundles quick links */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold mb-1">Fiber Bundles</h3>
          <div className="flex flex-wrap gap-2">
            {FIBER_COMMON_COLORS.map((color) => (
              <Link
                key={`bundles-${color}`}
                href={`/category/fiber_bundles?color=${encodeURIComponent(
                  color
                )}`}
                className="inline-block rounded-full border px-3 py-1 text-sm hover:underline"
                aria-label={`Fiber Bundles color ${color}`}
              >
                {color}
              </Link>
            ))}
          </div>
        </div>

        {/* NEW: Fibers quick links */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Fibers</h3>
          <div className="flex flex-wrap gap-2">
            {FIBER_COMMON_COLORS.map((color) => (
              <Link
                key={`fibers-${color}`}
                href={`/category/fibers?color=${encodeURIComponent(color)}`}
                className="inline-block rounded-full border px-3 py-1 text-sm hover:underline"
                aria-label={`Fibers color ${color}`}
              >
                {color}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Category list with per-user counts */}
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-lg font-medium mb-2">
          Your categories
        </h2>
        <ul className="divide-y border rounded">
          {CATEGORIES.map((cat) => {
            const count = counts.get(cat.label) ?? 0;
            return (
              <li key={cat.slug} className="flex items-center justify-between p-3">
                <Link
                  href={`/category/${cat.slug}`}
                  className="hover:underline font-medium"
                  aria-label={`Open ${cat.label} category`}
                >
                  {cat.label}
                </Link>
                <span aria-label={`${cat.label} count`} className="text-sm">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}




