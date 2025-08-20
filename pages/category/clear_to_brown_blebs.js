// Build: 36.10c_2025-08-20
// Dedicated Blebs page with robust pagination; per-page header build tag removed (global badge remains).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 24;
const CATEGORY_LABEL = "Blebs (clear to brown)";
const COLOR_COLUMN = "bleb_color";

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

export default function BlebsCategoryPage() {
  const router = useRouter();
  const urlColor = typeof router.query?.color === "string" ? router.query.color : "";

  const [user, setUser] = useState(null);
  const [count, setCount] = useState(null); // null = unknown
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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

  // Reset list when filter changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(null);
    setStatus("");
  }, [urlColor]);

  // Fetch total count (may be unknown/null if API fails)
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const base = supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category", CATEGORY_LABEL);

      const q = urlColor ? base.eq(COLOR_COLUMN, urlColor) : base;
      const { count: total, error } = await q;

      if (canceled) return;
      if (error) {
        setCount(null); // unknown, but don’t block UI
        return;
      }
      setCount(typeof total === "number" ? total : null);
    })();
    return () => { canceled = true; };
  }, [user?.id, urlColor]);

  // Load a page (append)
  async function loadMore() {
    if (!user?.id) return;
    setLoading(true);
    setStatus(items.length === 0 ? "Loading..." : "");

    let q = supabase
      .from("image_metadata")
      .select("id, path, filename, category, bleb_color, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .eq("category", CATEGORY_LABEL)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (urlColor) q = q.eq(COLOR_COLUMN, urlColor);

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
    if (user?.id && offset === 0 && items.length === 0) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, urlColor]);

  // Determine if more pages likely exist
  const hasMore = useMemo(() => {
    if (loading) return false;
    if (items.length === 0) return false;
    if (typeof count === "number") return items.length < count;
    return items.length % PAGE_SIZE === 0; // unknown count: if last page was full, offer more
  }, [items.length, count, loading]);

  function cardColorBadge(row) {
    if (row.category === CATEGORY_LABEL && row.bleb_color) return <Badge>Color: {row.bleb_color}</Badge>;
    return null;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {CATEGORY_LABEL}
          {urlColor ? (
            <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>(filtered: {urlColor})</span>
          ) : null}
        </h1>
        {/* Per-page build tag removed; global badge in _app.js is the single source of truth. */}
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>Please sign in to view this page.</div>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            Total in this category{urlColor ? " (filtered)" : ""}:{" "}
            <strong>{typeof count === "number" ? count : "…"}</strong>
          </div>

          {status && items.length === 0 ? (
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>{status}</div>
          ) : null}

          {/* Grid */}
          {items.length > 0 ? (
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
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}

          {/* Load more / end-of-list / empty */}
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
            ) : status ? null : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No items in this category yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

