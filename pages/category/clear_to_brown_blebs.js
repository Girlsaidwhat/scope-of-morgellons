// pages/category/clear_to_brown_blebs.js
// Build 36.26_2025-08-22
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import QuickColors from "../../components/QuickColors";

const CATEGORY_LABEL = "Blebs (clear to brown)";
// Display "Clear/White" but query value "Clear" to match DB
const BLEB_COLORS = [
  { label: "Clear/White", value: "Clear" },
  { label: "Yellow", value: "Yellow" },
  { label: "Orange", value: "Orange" },
  { label: "Red", value: "Red" },
  { label: "Brown", value: "Brown" },
];
const PAGE_SIZE = 24;

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

// simple inline styles
const pageStyle = { maxWidth: 980, margin: "0 auto", padding: "16px" };
const headerRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 6,
};
const h1Style = { fontSize: 22, fontWeight: 700, margin: 0 };
const countStyle = { fontSize: 13, color: "#444" };
const statusStyle = { fontSize: 13, color: "#555", margin: "8px 0 12px" };
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
  gap: 12,
};
const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  overflow: "hidden",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
};
const thumbWrap = { aspectRatio: "4 / 3", background: "#f5f5f5" };
const imgStyle = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const meta = { padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 };
const badgeRow = { display: "flex", flexWrap: "wrap", gap: 6 };
const badge = {
  display: "inline-block",
  fontSize: 11,
  border: "1px solid #ccc",
  borderRadius: 999,
  padding: "3px 8px",
  background: "#fafafa",
  color: "#111",
};
const actions = {
  marginTop: 6,
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};
const btn = {
  fontSize: 12,
  border: "1px solid #ccc",
  borderRadius: 6,
  padding: "6px 10px",
  background: "#fff",
  cursor: "pointer",
  textDecoration: "none",
  color: "#111",
};
const loadMoreWrap = { display: "flex", justifyContent: "center", marginTop: 14 };

export default function ClearToBrownBlebsPage() {
  const router = useRouter();
  const colorParam = useMemo(() => {
    const c = router.query?.color;
    return typeof c === "string" ? c : Array.isArray(c) ? c[0] : "";
  }, [router.query]);

  const [userPresent, setUserPresent] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [page, setPage] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [more, setMore] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      if (!on) return;
      setUserPresent(!!authData?.user);
    })();
    return () => { on = false; };
  }, []);

  // reset on color change
  useEffect(() => {
    setItems([]);
    setCount(null);
    setPage(0);
    setMore(true);
  }, [colorParam]);

  // count using exact-match equality on either column (RLS-safe)
  useEffect(() => {
    let on = true;
    (async () => {
      if (!supabase) return;
      setStatus("Loading…");
      let q = supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("category", CATEGORY_LABEL);
      if (colorParam) {
        q = q.or(`bleb_color.eq.${colorParam},color.eq.${colorParam}`);
      }
      const { count: c, error } = await q;
      if (!on) return;
      if (error) {
        console.error("count error:", error);
        setCount(0);
        setStatus("Failed to load.");
      } else {
        setCount(c || 0);
        setStatus("");
      }
    })();
    return () => { on = false; };
  }, [colorParam]);

  // fetch a page (same filter)
  async function fetchPage(nextPage) {
    if (!supabase || loadingPage || !more) return;
    setLoadingPage(true);
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("image_metadata")
      .select("*")
      .eq("category", CATEGORY_LABEL)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (colorParam) {
      q = q.or(`bleb_color.eq.${colorParam},color.eq.${colorParam}`);
    }

    const { data, error } = await q;
    if (error) {
      console.error("page fetch error:", error);
      setStatus("Failed to load.");
      setLoadingPage(false);
      setMore(false);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    setItems((prev) => [...prev, ...rows]);
    setPage(nextPage);
    setLoadingPage(false);
    if (rows.length < PAGE_SIZE) setMore(false);
  }

  // initial page & on color change
  useEffect(() => {
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorParam]);

  function getPublicUrl(row) {
    if (row?.public_url) return row.public_url;
    const path = row?.storage_path || row?.file_path;
    if (supabase && path) {
      const { data } = supabase.storage.from("images").getPublicUrl(path);
      return data?.publicUrl || "";
    }
    return "";
  }

  async function handleCopy(url) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Image link copied.");
    } catch {
      alert("Copy failed.");
    }
  }

  const statusText = userPresent === false
    ? "Not signed in. Your items may be empty."
    : status;

  return (
    <main id="main" style={pageStyle}>
      <div style={headerRow}>
        <h1 style={h1Style}>{CATEGORY_LABEL}</h1>
        <span aria-live="polite" style={countStyle}>
          {count === null ? "" : `${count} item${count === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Compact toolbar; softened chip color; no Clear button */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <QuickColors
          baseHref="/category/clear_to_brown_blebs"
          label="Colors"
          colors={BLEB_COLORS}
          activeColor={colorParam}
        />
      </div>

      <p aria-live="polite" style={statusStyle}>{statusText}</p>

      <section aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" style={{ position: "absolute", left: -9999, top: "auto" }}>
          Gallery
        </h2>
        <ul style={grid}>
          {items.map((row) => {
            const url = getPublicUrl(row);
            const color = row?.bleb_color || row?.color || "";
            return (
              <li key={row.id} style={card}>
                <div style={thumbWrap}>
                  {url ? (
                    <img src={url} alt={row.filename || "Image"} style={imgStyle} />
                  ) : (
                    <div style={{...imgStyle, display:"flex", alignItems:"center", justifyContent:"center", color:"#888", fontSize:12}}>
                      No preview
                    </div>
                  )}
                </div>
                <div style={meta}>
                  <div style={badgeRow}>
                    <span style={badge} aria-label="Category">{CATEGORY_LABEL}</span>
                    {color ? <span style={badge} aria-label="Color">{color}</span> : null}
                  </div>
                  <div style={actions}>
                    {url ? (
                      <>
                        <button style={btn} onClick={() => handleCopy(url)} aria-label="Copy image link">
                          Copy image link
                        </button>
                        <a style={btn} href={url} target="_blank" rel="noopener noreferrer" aria-label="Open image in new tab">
                          Open image
                        </a>
                      </>
                    ) : null}
                    <Link href={`/image/${row.id}`} legacyBehavior>
                      <a style={btn} aria-label="Open image details">Details</a>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div style={loadMoreWrap}>
        {more ? (
          <button
            style={btn}
            onClick={() => fetchPage(page + 1)}
            aria-busy={loadingPage ? "true" : "false"}
            disabled={loadingPage}
          >
            {loadingPage ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "#666" }}>
            {items.length === 0 ? "No items." : "End of results."}
          </span>
        )}
      </div>
    </main>
  );
}






