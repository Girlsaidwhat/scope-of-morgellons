// pages/_app.js
// Build 36.19_2025-08-21
import "../styles/globals.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.19_2025-08-21";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

function BuildBadge() {
  const badgeStyle = {
    position: "fixed",
    right: 8,
    bottom: 8,
    zIndex: 9999,
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    color: "#fff",
    background: "#111",
    border: "1px solid #000",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  };
  return (
    <div id="global-build-badge" aria-label="Build version" style={badgeStyle}>
      {BUILD_VERSION}
    </div>
  );
}

// Visually hidden “Skip to content” that appears on focus
const srOnly = {
  position: "absolute",
  left: "-10000px",
  top: "auto",
  width: "1px",
  height: "1px",
  overflow: "hidden",
};
const srOnlyFocus = {
  position: "static",
  width: "auto",
  height: "auto",
  overflow: "visible",
  padding: "4px 8px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  margin: 8,
  display: "inline-block",
};

// CSV helpers
function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const pref = [
    "id",
    "filename",
    "category",
    "color",
    "bleb_color",
    "uploader_initials",
    "uploader_age",
    "uploader_location",
    "uploader_contact_opt_in",
    "notes",
    "created_at",
    "storage_path",
    "file_path",
    "public_url",
  ];
  const allKeys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r || {}).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const extras = allKeys.filter((k) => !pref.includes(k));
  const headers = [...pref.filter((k) => allKeys.includes(k)), ...extras];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(","));
  return lines.join("\n");
}

function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Global quick-color + export toolbar (Fibers, Fiber Bundles, Blebs)
function QuickColorToolbar() {
  const router = useRouter();
  const asPath = router?.asPath || "";
  const pathname = router?.pathname || "";
  const q = router?.query || {};
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  const slug =
    typeof q.slug === "string"
      ? q.slug
      : Array.isArray(q.slug)
      ? q.slug[0]
      : "";

  const onBundles =
    asPath.startsWith("/category/fiber_bundles") ||
    pathname.startsWith("/category/fiber_bundles") ||
    slug === "fiber_bundles";

  const onFibers =
    asPath.startsWith("/category/fibers") ||
    pathname.startsWith("/category/fibers") ||
    slug === "fibers";

  const onBlebs =
    asPath.startsWith("/category/clear_to_brown_blebs") ||
    pathname.startsWith("/category/clear_to_brown_blebs") ||
    slug === "clear_to_brown_blebs";

  if (!onBundles && !onFibers && !onBlebs) return null;

  const COLORS = onBlebs
    ? ["Clear", "Yellow", "Orange", "Red", "Brown"]
    : ["white/clear", "blue", "black", "red", "other"];

  const baseHref = onBundles
    ? "/category/fiber_bundles"
    : onFibers
    ? "/category/fibers"
    : "/category/clear_to_brown_blebs";

  const activeColor =
    typeof q.color === "string"
      ? q.color
      : Array.isArray(q.color)
      ? q.color[0]
      : "";

  const dbCategory = onBundles
    ? "Fiber Bundles"
    : onFibers
    ? "Fibers"
    : "Blebs (clear to brown)";

  const wrap = {
    position: "fixed",
    left: 8,
    bottom: 48,
    zIndex: 9998,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    padding: "8px 10px",
    maxWidth: "calc(100vw - 140px)",
  };
  const title = { fontSize: 12, fontWeight: 600, marginBottom: 6 };
  const row = { display: "flex", flexWrap: "wrap", gap: 8 };

  const chip = {
    display: "inline-block",
    border: "1px solid #ccc",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "#111",
    background: "#fafafa",
    textDecoration: "none",
  };
  const chipActive = { ...chip, color: "#fff", background: "#111", borderColor: "#111" };
  const chipClear = { ...chip, background: "#f6f6f6", borderStyle: "dashed" };
  const exportBtn = { ...chipActive, background: "#0b5fff", borderColor: "#0b5fff" };
  const statusStyle = { fontSize: 12, color: "#555", marginTop: 6 };

  async function handleExport(e) {
    e.preventDefault();
    if (!supabase) return;
    try {
      setExporting(true);
      setStatus("Exporting…");

      let query = supabase
        .from("image_metadata")
        .select("*")
        .eq("category", dbCategory)
        .order("created_at", { ascending: false });

      if (activeColor) {
        query = query.or(`color.eq.${activeColor},bleb_color.eq.${activeColor}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setStatus("No rows for this filter.");
        setExporting(false);
        return;
      }

      const csv = toCSV(data);
      const today = new Date();
      const y = String(today.getFullYear());
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const colorPart = activeColor ? `_${activeColor.replace(/\s+/g, "_")}` : "";
      const slugPart = onBundles ? "fiber_bundles" : onFibers ? "fibers" : "clear_to_brown_blebs";
      const filename = `export_${slugPart}${colorPart}_${y}-${m}-${d}.csv`;

      downloadCSV(filename, csv);
      setStatus(`Exported ${data.length} rows to ${filename}.`);
    } catch (err) {
      console.error("CSV export error:", err);
      setStatus("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <nav aria-label="Quick colors and export" style={wrap}>
      <div style={title}>
        {onBundles ? "Fiber Bundles" : onFibers ? "Fibers" : "Blebs (clear to brown)"} · Quick colors
        {activeColor ? ` · Active: ${activeColor}` : ""}
      </div>

      {/* Row: Clear + Colors */}
      <div style={row}>
        <Link href={baseHref} legacyBehavior>
          <a aria-label="Clear color filter" style={activeColor ? chipClear : chip}>
            Clear color
          </a>
        </Link>
        {COLORS.map((c) => {
          const isActive = (activeColor || "")?.toLowerCase() === c.toLowerCase();
          return (
            <Link key={c} href={`${baseHref}?color=${encodeURIComponent(c)}`} legacyBehavior>
              <a aria-label={`Filter by color ${c}`} aria-current={isActive ? "page" : undefined} style={isActive ? chipActive : chip}>
                {c}
              </a>
            </Link>
          );
        })}
      </div>

      {/* Row: Export */}
      <div style={{ ...row, marginTop: 8 }}>
        <a href="#" onClick={handleExport} aria-busy={exporting ? "true" : "false"} style={exportBtn}>
          {exporting ? "Exporting…" : "Export CSV"}
        </a>
      </div>

      {/* Status */}
      <div aria-live="polite" style={statusStyle}>{status}</div>
    </nav>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // Remove legacy build lines anywhere except the global badge
  useEffect(() => {
    // Remove explicit markers
    document.querySelectorAll("[data-build-line]").forEach((n) => n.remove());

    // Remove any element whose text is exactly a Build string, excluding the global badge
    const badge = document.getElementById("global-build-badge");
    const buildRe = /^Build\s+\d+(?:\.\d+)*_\d{4}-\d{2}-\d{2}$/;

    // Scan shallowly to avoid perf hit
    const all = Array.from(document.body.querySelectorAll("*"));
    for (const el of all) {
      if (el === badge || (badge && el.contains(badge))) continue;
      const t = (el.textContent || "").trim();
      if (buildRe.test(t)) {
        el.remove();
      }
    }
  }, []);

  // Keyboard shortcuts: Alt+Shift+H (Home), Alt+Shift+B (Browse), Alt+Shift+U (Upload)
  useEffect(() => {
    function onKeyDown(e) {
      if (!e.altKey || !e.shiftKey) return;
      const k = e.key?.toLowerCase();
      if (k === "h") {
        e.preventDefault();
        router.push("/");
      } else if (k === "b") {
        e.preventDefault();
        router.push("/browse");
      } else if (k === "u") {
        e.preventDefault();
        router.push("/upload");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  function handleSkipFocus(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnlyFocus)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")
    );
  }
  function handleSkipBlur(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnly)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")
    );
  }

  return (
    <>
      <a
        href="#main"
        onFocus={handleSkipFocus}
        onBlur={handleSkipBlur}
        style={srOnly}
      >
        Skip to content
      </a>
      <Component {...pageProps} />
      <QuickColorToolbar />
      <BuildBadge />
    </>
  );
}









