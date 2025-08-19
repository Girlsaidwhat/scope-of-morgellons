// Build: 36.10a4_2025-08-19
// Category listing with "Load more" pagination, newest first.
// Respects optional ?color=... for Blebs, Fiber Bundles, and Fibers.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 24;

// Map URL slug -> enum label in DB
const SLUG_TO_CATEGORY = {
  clear_to_brown_blebs: "Blebs (clear to brown)",
  biofilm: "Biofilm",
  fiber_bundles: "Fiber Bundles",
  fibers: "Fibers",
  hexagons: "Hexagons",
  crystalline_structures: "Crystalline Structures",
  feathers: "Feathers",
  miscellaneous: "Miscellaneous",
  hairs: "Hairs",
  skin: "Skin",
  wounds: "Wounds",
};

function prettyDate(s) {
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s || "";
  }
}

function Badge({ children }) {
  return (
    <span style={{ fontSize: 12, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999 }}>
      {children}
    </span>
  );
}

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;
  const urlColor = typeof router.query?.color === "string" ? router.query.color : "";

  const [user, setUser] = useState(null);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const categoryLabel = useMemo(() => SLUG_TO_CATEGORY[slug] || "", [slug]);

  // Which color column (if any) applies to this category?
  const colorColumn = useMemo(() => {
    if (!categoryLabel) return null;
    if (categoryLabel === "Blebs (clear to brown)") return "bleb_color";
    if (categoryLabel === "Fiber Bundles") return "fiber_bundles_color";
    if (categoryLabel === "Fibers") return "fibers_color";
    return null;
  }, [categoryLabel]);

  // Load user
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data?.user ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Reset list when category or color changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(0);
    setStatus("");
  }, [categoryLabel, urlColor]);

  // Fetch total count for header
  useEffect(() => {
    if (!user?.id || !categoryLabel) return;
    let canceled = false;
    (async () => {
      const q = supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category", categoryLabel);

      const q2 = colorColumn && urlColor ? q.eq(colorColumn, urlColor) : q;

      const { count: total, error } = await q2;
      if (canceled) return;
      if (error) {
        setStatus(`Count error: ${error.message}`);
        return;
      }
      setCount(total || 0);
    })();
    return () => {
      canceled = true;
    };
  }, [user?.id, categoryLabel, colorColumn, urlColor]);

  // Load a page of items (append)
  async function loadMore() {
    if (!user?.id || !categoryLabel) return;
    setLoading(true);
    setStatus(items.length === 0 ? "Loading..." : "");

    let q = supabase
      .from("image_metadata")
      .select("id, path, filename, category, bleb_color, fiber_bundles_color, fibers_color, created_at", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .eq("category", categoryLabel)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (colorColumn && urlColor) {
      q = q.eq(colorColumn, urlColor);
    }

    const { data, error } = await q;

    if (error) {
      setStatus(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    setItems((prev) => [...prev, ...(data || [])]);
    setOffset((prev) => prev + (data?.length || 0));
    setLoading(false);
    setStatus("");
  }

  // Initial load
  useEffect(() => {
    if (user?.id && categoryLabel && offset === 0 && items.length === 0) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, categoryLabel, colorColumn, urlColor]);

  function cardColorBadge(row) {
    if (row.category === "Blebs (clear to brown)" && row.bleb_color) return <Badge>Color: {row.bleb_color}</Badge>;
    if (row.category === "Fiber Bundles" && row.fiber_bundles_color) return <Badge>Color: {row.fiber_bundles_color}</Badge>;
    if (row.category === "Fibers" && row.fibers_color) return <Badge>Color: {row.fibers_color}</Badge>;
    return null;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {categoryLabel || "Category"}
          {colorColumn && urlColor ? (
            <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>
              (filtered: {urlColor})
            </span>
          ) : null}
        </h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Build: 36.10a4_2025-08-19</div>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>Please sign in to view this page.</div>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            Total in this category{colorColumn && urlColor ? " (filtered)" : ""}: <strong>{count}</strong>
          </div>

          {status && items.length === 0 ? (
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>{status}</div>
          ) : (
            <>
              {/* Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {items.map((row) =
