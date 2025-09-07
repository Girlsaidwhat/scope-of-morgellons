// pages/image/[id].js
// Build: 36.25_bleb-multi-safe_2025-09-07
// Change: SAFE load (select "*"), tolerate missing columns, keep multi Bleb colors & multi-category editor.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---- Category constants ----
const BLEBS_LABEL = "Blebs (clear to brown)";
const CATEGORY_LABELS = [
  BLEBS_LABEL,
  "Biofilm",
  "Spiky Biofilm",
  "Fiber Bundles",
  "Fibers",
  "Hexagons",
  "Crystalline Structures",
  "Feathers",
  "Hairs",
  "Skin",
  "Lesions",
  "Fire Hair",
  "Fire Skin",
  "Sparkle Skin",
  "Embedded Fibers",
  "Embedded Artifacts",
  "Spiral Artifacts",
  "Other",
];

// Bleb Color options
const BLEB_COLOR_OPTIONS = ["Clear", "Yellow", "Orange", "Red", "Brown"];

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

function srOnly() {
  return {
    position: "absolute",
    left: -9999,
    top: "auto",
    width: 1,
    height: 1,
    overflow: "hidden",
  };
}

export default function ImageDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState(null);
  const [row, setRow] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Landing feature state
  const [featured, setFeatured] = useState(false);
  const [featureBusy, setFeatureBusy] = useState(false);

  // Category editor state (multi-select)
  const [categories, setCategories] = useState([]); // array of labels
  const [catBusy, setCatBusy] = useState(false);
  const [catMsg, setCatMsg] = useState("");

  // Bleb colors (multiple)
  const [blebColors, setBlebColors] = useState([]); // array of strings from BLEB_COLOR_OPTIONS
  const [showBlebPrompt, setShowBlebPrompt] = useState(false);
  const [modalSel, setModalSel] = useState([]); // working selection in modal
  const firstChkRef = useRef(null);

  // Auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data?.user ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // Load row (SAFE: select("*") so missing columns don't break)
  useEffect(() => {
    if (!user?.id || !id) return;
    let canceled = false;
    setLoading(true);
    setStatus("Loading...");
    (async () => {
      const idValue = /^\d+$/.test(String(id)) ? Number(id) : id; // tolerate numeric PKs
      const { data, error } = await supabase
        .from("image_metadata")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", idValue)
        .maybeSingle();

      if (canceled) return;

      if (error) {
        setStatus(`Load error: ${error.message}`);
        setRow(null);
        setLoading(false);
        return;
      }
      if (!data) {
        setStatus("Not found.");
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data);
      setNotes(data?.notes || "");
      setStatus("");
      setLoading(false);

      // Categories (prefer array if present; else wrap legacy)
      const incomingCats = Array.isArray(data?.categories)
        ? data.categories
        : (data?.category ? [data.category] : []);
      const normalized = (incomingCats || []).filter((c) => CATEGORY_LABELS.includes(c));
      setCategories(normalized);

      // Bleb colors: prefer array; else wrap legacy single
      const bc = Array.isArray(data?.bleb_colors)
        ? data.bleb_colors
        : (data?.bleb_color ? [data.bleb_color] : []);
      setBlebColors((bc || []).filter((v) => BLEB_COLOR_OPTIONS.includes(v)));

      // Featured?
      const { data: pg, error: pgErr } = await supabase
        .from("public_gallery")
        .select("id")
        .eq("image_id", data.id)
        .limit(1);
      if (!pgErr) setFeatured((pg && pg.length > 0) || false);
    })();

    return () => { canceled = true; };
  }, [user?.id, id]);

  const publicUrl = useMemo(() => {
    if (!row?.path) return "";
    const { data: pub } = supabase.storage.from("images").getPublicUrl(row.path);
    return pub?.publicUrl || "";
  }, [row?.path]);

  // Focus first checkbox when modal opens
  useEffect(() => {
    if (showBlebPrompt) setTimeout(() => firstChkRef.current?.focus?.(), 0);
  }, [showBlebPrompt]);

  async function saveNotes(e) {
    e.preventDefault();
    if (!user?.id || !row?.id) return;
    setSaving(true);
    setStatus("Saving...");

    const { error } = await supabase
      .from("image_metadata")
      .update({ notes: notes || null })
      .eq("id", row.id)
      .eq("user_id", user.id);

    if (error) {
      setStatus(`Save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setStatus("Notes saved.");
    setSaving(false);
    setTimeout(() => setStatus(""), 1500);
  }

  // ---- Landing "Feature" actions (public thumbnail pipeline) ----
  function extToMime(ext) {
    const e = (ext || "").toLowerCase();
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "png") return "image/png";
    return "application/octet-stream";
  }

  async function handleFeature() {
    if (!user?.id || !row?.id) return;
    setFeatureBusy(true);
    setStatus("Featuring on landing...");

    try {
      const sourcePath = row.path || row.storage_path;
      const { data: blob, error: dlErr } = await supabase.storage.from("images").download(sourcePath);
      if (dlErr) throw dlErr;

      const ext = (row.ext || "").replace(/^\./, "") || "jpg";
      const targetPath = `${user.id}/image-${row.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("public-thumbs")
        .upload(targetPath, blob, { upsert: true, contentType: extToMime(ext) });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("public_gallery")
        .insert({ image_id: row.id, public_path: targetPath });
      if (insErr) throw insErr;

      setFeatured(true);
      setStatus("Added to landing.");
      setTimeout(() => setStatus(""), 1500);
    } catch (err) {
      setStatus(`Feature error: ${err?.message || "Unknown error"}`);
    } finally {
      setFeatureBusy(false);
    }
  }

  async function handleUnfeature() {
    if (!user?.id || !row?.id) return;
    setFeatureBusy(true);
    setStatus("Removing from landing...");

    try {
      const ext = (row.ext || "").replace(/^\./, "") || "jpg";
      const targetPath = `${user.id}/image-${row.id}.${ext}`;

      const { error: delObjErr } = await supabase.storage
        .from("public-thumbs")
        .remove([targetPath]);
      if (delObjErr && !/Not Found|does not exist/i.test(delObjErr.message)) {
        throw delObjErr;
      }

      const { error: delRowErr } = await supabase
        .from("public_gallery")
        .delete()
        .eq("image_id", row.id);
      if (delRowErr) throw delRowErr;

      setFeatured(false);
      setStatus("Removed from landing.");
      setTimeout(() => setStatus(""), 1500);
    } catch (err) {
      setStatus(`Remove error: ${err?.message || "Unknown error"}`);
    } finally {
      setFeatureBusy(false);
    }
  }

  async function handleDelete() {
    if (!user?.id || !row?.id) return;
    const ok = window.confirm(`Delete this image and its metadata?\n\n${row.filename}\n\nThis cannot be undone.`);
    if (!ok) return;

    setDeleting(true);
    setStatus("Deleting...");

    try {
      const ext = (row.ext || "").replace(/^\./, "") || "jpg";
      const targetPath = `${user.id}/image-${row.id}.${ext}`;
      await supabase.storage.from("public-thumbs").remove([targetPath]);
      await supabase.from("public_gallery").delete().eq("image_id", row.id);
    } catch {}

    const removeRes = await supabase.storage.from("images").remove([row.path]);
    if (removeRes.error && !/Not Found|does not exist/i.test(removeRes.error.message)) {
      setStatus(`Storage delete error: ${removeRes.error.message}`);
      setDeleting(false);
      return;
    }

    const { error: dbErr } = await supabase
      .from("image_metadata")
      .delete()
      .eq("id", row.id)
      .eq("user_id", user.id);

    if (dbErr) {
      setStatus(`Database delete error: ${dbErr.message}`);
      setDeleting(false);
      return;
    }

    setStatus("Deleted.");
    setTimeout(() => {
      router.push("/?deleted=1");
    }, 200);
  }

  // ---------- Category editor ----------

  function toggleCategory(label) {
    setCategories((prev) => {
      const has = prev.includes(label);
      const next = has ? prev.filter((c) => c !== label) : [...prev, label];
      // When adding Blebs and no color yet, prompt for colors
      if (!has && label === BLEBS_LABEL && (blebColors?.length || 0) === 0) {
        setModalSel([]); // start empty
        setShowBlebPrompt(true);
      }
      return next;
    });
  }

  async function persistCategories() {
    if (!user?.id || !row?.id) return;
    setCatBusy(true);
    setCatMsg("Saving categories...");

    const payloads = [];
    payloads.push({ try: { categories }, desc: "categories" }); // multi (if column exists)
    const primary = categories[0] || null;
    payloads.push({ try: { category: primary }, desc: "category" }); // legacy

    let lastErr = null;
    for (const step of payloads) {
      try {
        const { error } = await supabase
          .from("image_metadata")
          .update(step.try)
          .eq("id", row.id)
          .eq("user_id", user.id);
        if (error) {
          const raw = (error.message || "").toLowerCase();
          const ignorable =
            raw.includes("does not exist") ||
            raw.includes("unknown column") ||
            raw.includes("could not find") ||
            raw.includes("schema cache") ||
            (raw.includes("column") && raw.includes("not found"));
          if (!ignorable) throw error;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) {
      setCatMsg(`Some fields failed: ${lastErr.message}`);
      setCatBusy(false);
      setTimeout(() => setCatMsg(""), 2000);
      return;
    }

    setRow((r) => (r ? { ...r, category: primary, categories: [...categories] } : r));
    setCatMsg("Saved.");
    setCatBusy(false);
    setTimeout(() => setCatMsg(""), 1200);
  }

  // ---------- Bleb color helpers ----------

  function openBlebModal(prefillFromState = true) {
    setModalSel(prefillFromState ? [...(blebColors || [])] : []);
    setShowBlebPrompt(true);
  }

  function toggleModalColor(opt) {
    setModalSel((prev) => (prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]));
  }

  async function saveBlebColors(newColors) {
    if (!user?.id || !row?.id) return;
    setStatus("Saving colors...");

    const updates = [
      { try: { bleb_colors: newColors }, desc: "bleb_colors[]" }, // preferred (text[] or jsonb)
      { try: { bleb_color: (newColors[0] || null) }, desc: "bleb_color (legacy)" }, // legacy single
    ];

    let lastErr = null;
    for (const step of updates) {
      try {
        const { error } = await supabase
          .from("image_metadata")
          .update(step.try)
          .eq("id", row.id)
          .eq("user_id", user.id);
        if (error) {
          const raw = (error.message || "").toLowerCase();
          const ignorable =
            raw.includes("does not exist") ||
            raw.includes("unknown column") ||
            raw.includes("could not find") ||
            raw.includes("schema cache") ||
            (raw.includes("column") && raw.includes("not found"));
          if (!ignorable) throw error;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) {
      setStatus(`Save error: ${lastErr.message}`);
      setShowBlebPrompt(false);
      return;
    }

    setBlebColors([...(newColors || [])]);
    setRow((r) =>
      r ? { ...r, bleb_colors: [...(newColors || [])], bleb_color: (newColors?.[0] || null) } : r
    );
    setStatus("Color(s) saved.");
    setShowBlebPrompt(false);
    setTimeout(() => setStatus(""), 1200);
  }

  // ---------- Display helpers (de-dup badges) ----------

  const displayCategories = useMemo(() => {
    const source = (Array.isArray(categories) && categories.length > 0)
      ? categories
      : (Array.isArray(row?.categories) && row.categories.length > 0)
      ? row.categories
      : (row?.category ? [row.category] : []);
    const uniq = Array.from(new Set(source)).filter(Boolean);
    return uniq;
  }, [categories, row?.categories, row?.category]);

  function colorBadge() {
    const hasBlebs = displayCategories.includes(BLEBS_LABEL);
    const list = (blebColors?.length
      ? blebColors
      : (Array.isArray(row?.bleb_colors) ? row.bleb_colors : (row?.bleb_color ? [row.bleb_color] : []))) || [];
    const clean = list.filter(Boolean).map((c) => String(c).replace(/\b\w/g, (m) => m.toUpperCase()));
    if (hasBlebs && clean.length) return <Badge>Colors: {clean.join(", ")}</Badge>;
    const hasBundles = displayCategories.includes("Fiber Bundles");
    if (hasBundles && row?.fiber_bundles_color) return <Badge>Color: {row.fiber_bundles_color}</Badge>;
    const hasFibers = displayCategories.includes("Fibers");
    if (hasFibers && row?.fibers_color) return <Badge>Color: {row.fibers_color}</Badge>;
    return null;
  }

  // ---------- Render ----------

  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => (typeof window !== "undefined" ? window.history.back() : (router.push("/"), null))}
          aria-label="Go back"
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 22, margin: 0 }}>Image Detail</h1>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>Please sign in to view this page.</div>
      ) : loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          {status || "Loading..."}
        </div>
      ) : !row ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Not found or not accessible.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Large preview */}
            <div
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl}
                alt={row.filename}
                style={{ display: "block", width: "100%", height: "auto", maxHeight: 700, objectFit: "contain" }}
              />
            </div>

            {/* Right column: metadata + actions */}
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 12,
                }}
              >
                {/* Badges row (deduped) */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {displayCategories.map((c) => <Badge key={c}>{c}</Badge>)}
                  {colorBadge()}
                </div>

                {/* Metadata list */}
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <div><strong>Filename:</strong> {row.filename}</div>
                  <div><strong>Type:</strong> {row.ext?.toUpperCase() || "—"}</div>
                  <div><strong>Uploaded:</strong> {prettyDate(row.created_at)}</div>
                  <div><strong>Storage path:</strong> {row.path}</div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    aria-label="Delete this image"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #991b1b",
                      background: deleting ? "#fca5a5" : "#ef4444",
                      color: "white",
                      fontWeight: 700,
                      cursor: deleting ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete image"}
                  </button>

                  {!featured ? (
                    <button
                      onClick={handleFeature}
                      disabled={featureBusy}
                      aria-label="Feature this image on the landing page"
                      title="Copy a public thumbnail and show it on the landing page"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #1e293b",
                        background: featureBusy ? "#94a3b8" : "#111827",
                        color: "white",
                        fontWeight: 700,
                        cursor: featureBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      {featureBusy ? "Featuring…" : "Feature on landing"}
                    </button>
                  ) : (
                    <button
                      onClick={handleUnfeature}
                      disabled={featureBusy}
                      aria-label="Remove this image from the landing page"
                      title="Remove the public thumbnail and entry"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #334155",
                        background: featureBusy ? "#94a3b8" : "#475569",
                        color: "white",
                        fontWeight: 700,
                        cursor: featureBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      {featureBusy ? "Removing…" : "Remove from landing"}
                    </button>
                  )}

                  <span role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.8 }}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Category editor */}
              <section
                aria-labelledby="categories-heading"
                style={{ border: "1px solid #e5e5e5", borderRadius: 10, background: "#fff", padding: 12 }}
              >
                <h2 id="categories-heading" style={srOnly()}>Categories</h2>
                <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.85 }}>
                  Select all categories that fit this image.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CATEGORY_LABELS.map((label) => {
                    const active = categories.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleCategory(label)}
                        aria-pressed={active ? "true" : "false"}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
                          background: active ? "#14b8a6" : "#f9fafb",
                          color: active ? "white" : "inherit",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "transform 120ms ease, box-shadow 120ms ease",
                        }}
                        title={label}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Bleb color editor affordance when Blebs is selected */}
                {categories.includes(BLEBS_LABEL) ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => openBlebModal(true)}
                      aria-label="Edit bleb colors"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #0f766e",
                        background: "#14b8a6",
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Edit Bleb colors
                    </button>
                    {blebColors.length ? (
                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>
                        Current: {blebColors.join(", ")}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={persistCategories}
                    disabled={catBusy}
                    aria-label="Save categories"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #0f766e",
                      background: catBusy ? "#8dd3cd" : "#14b8a6",
                      color: "white",
                      fontWeight: 700,
                      cursor: catBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {catBusy ? "Saving…" : "Save categories"}
                  </button>
                  <span role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.8 }}>
                    {catMsg}
                  </span>
                </div>
              </section>

              {/* Notes */}
              <form
                onSubmit={saveNotes}
                aria-labelledby="notes-heading"
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 12,
                }}
              >
                <h2 id="notes-heading" style={srOnly()}>Notes</h2>
                <label htmlFor="notes" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this image…"
                  rows={6}
                  style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    aria-label="Save notes"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #0f766e",
                      background: saving ? "#8dd3cd" : "#14b8a6",
                      color: "white",
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Saving..." : "Save Notes"}
                  </button>
                  <span role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.8 }}>
                    {status && !deleting ? status : ""}
                  </span>
                </div>
              </form>

              {/* Uploader snapshot */}
              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Uploader snapshot</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <div><strong>Initials:</strong> {row.uploader_initials || "—"}</div>
                  <div><strong>Age:</strong> {row.uploader_age ?? "—"}</div>
                  <div><strong>Location:</strong> {row.uploader_location || "—"}</div>
                  <div><strong>Contact opt-in:</strong> {row.uploader_contact_opt_in ? "Yes" : "No"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Bleb color modal (multi-select) ---- */}
          {showBlebPrompt ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bleb-dialog-title"
              aria-describedby="bleb-dialog-desc"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "grid",
                placeItems: "center",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  width: "min(92vw, 480px)",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                }}
              >
                <h2 id="bleb-dialog-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
                  Pick Bleb color(s)
                </h2>
                <p id="bleb-dialog-desc" style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.8 }}>
                  You selected “Blebs (clear to brown)”. Choose all colors that appear in this image.
                </p>

                <div style={{ display: "grid", gap: 8 }}>
                  {BLEB_COLOR_OPTIONS.map((opt, i) => {
                    const checked = modalSel.includes(opt);
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          ref={i === 0 ? firstChkRef : undefined}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModalColor(opt)}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setShowBlebPrompt(false)}
                    aria-label="Cancel without saving"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    onClick={() => saveBlebColors(modalSel)}
                    aria-label="Save selected colors"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #0f766e",
                      background: "#14b8a6",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    Save colors
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
