// Build: 36.11_2025-08-20
// Category listing with robust pagination + per-card actions: "Copy image link" + "Open image".
// Respects optional ?color=... for Blebs, Fiber Bundles, and Fibers. No per-page build header.

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
  const [count, setCount] = useState(null); // null = unknown
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Per-card "copied!" feedback
  const [copiedMap, setCopiedMap] = useState({});

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
    return () => { mounted = false; };
  }, []);

  // Reset list when category or color changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(null);
    setStatus("");
    setCopiedMap({});
  }, [categoryLabel, urlColor]);

  // Fetch total count (may be unknown/null if API fails)
  useEffect(() => {
    if (!user?.id || !categoryLabel) return;
    let canceled = false;
    (async () => {
      const base = supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category", categoryLabel);

      const q = colorColumn && urlColor ? base.eq(colorColumn, urlColor) : base;
      const { count: total, error } = await q;

      if (canceled) return;
      if (error) {
        setCount(null); // unknown; don’t block UI
        return;
      }
      setCount(typeof total === "number" ? total : null);
    })();
    return () => { canceled = true; };
  }, [user?.id, categoryLabel, colorColumn, urlColor]);

  // Load a page (append)
  async function loadMore() {
    if (!user?.id || !categoryLabel) return;
    setLoading(true);
    setStatus(items.length === 0 ? "Loading..." : "");

    let q = supabase
      .from("image_metadata")
      .select(
        "id, path, filename, category, bleb_color, fiber_bundles_color, fibers_color, created_at",
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .eq("category", categoryLabel)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (colorColumn && urlColor) q = q.eq(colorColumn, urlColor);

    const { data, error } = await q;

    if (error) {
      setStatus(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    const batch = data || [];
    setItems((prev) => [...prev, ...batch]);
    setOffset((prev) => prev + batch.length);
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

  // Determine if more pages likely exist
  const hasMore = useMemo(() => {
    if (loading) return false;
    if (items.length === 0) return false;
    if (typeof count === "number") return items.length < count;
    // Unknown count: show "Load more" if last page looked full
    return items.length % PAGE_SIZE === 0;
  }, [items.length, count, loading]);

  function cardColorBadge(row) {
    if (row.category === "Blebs (clear to brown)" && row.bleb_color) return <Badge>Color: {row.bleb_color}</Badge>;
    if (row.category === "Fiber Bundles" && row.fiber_bundles_color) return <Badge>Color: {row.fiber_bundles_color}</Badge>;
    if (row.category === "Fibers" && row.fibers_color) return <Badge>Color: {row.fibers_color}</Badge>;
    return null;
  }

  async function handleCopy(e, url, id) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMap((m) => ({ ...m, [id]: true }));
      setTimeout(() => setCopiedMap((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      }), 1000);
    } catch {
      alert("Copy failed.");
    }
  }

  function handleOpen(e, url) {
    e.preventDefault();
    e.stopPropagation();
    try {
      window.open(url, "_blank", "noopener");
    } catch {}
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {categoryLabel || "Category"}
          {colorColumn && urlColor ? (
            <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>(filtered: {urlColor})</span>
          ) : null}
        </h1>
        {/* No per-page build tag; global badge is the source of truth. */}
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>Please sign in to view this page.</div>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            Total in this category{colorColumn && urlColor ? " (filtered)" : ""}:{" "}
            <strong>{typeof count === "number" ? count : "…"}</strong>
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
                {items.map((row) => {
                  const { data: pub } = supabase.storage.from("images").getPublicUrl(row.path);
                  const url = pub?.publicUrl || "";
                  const copied = !!copiedMap[row.id];
                  return (
                    <a
                      key={row.id}
                      href={`/image/${row.id}`}
                      style={{
                        display: "block",
                        textDecoration: "none",
                        color: "inherit",
                        border: "1px solid #e5e5e5",
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#fff",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={row.filename}
                        style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                      />
                      <div style={{ padding: 10 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <Badge>{row.category}</Badge>
                          {cardColorBadge(row)}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{prettyDate(row.created_at)}</div>

                        {/* Card actions */}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button
                            onClick={(e) => handleCopy(e, url, row.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                            aria-label="Copy image link"
                            title="Copy image link"
                          >
                            {copied ? "Link copied!" : "Copy image link"}
                          </button>
                          <button
                            onClick={(e) => handleOpen(e, url)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                            aria-label="Open image in new tab"
                            title="Open image in new tab"
                          >
                            Open image
                          </button>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Load more / end-of-list */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #0f766e",
                      background: loading ? "#8dd3cd" : "#14b8a6",
                      color: "white",
                      cursor: loading ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? "Loading..." : "Load more"}
                  </button>
                ) : items.length > 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>No more items.</div>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}


