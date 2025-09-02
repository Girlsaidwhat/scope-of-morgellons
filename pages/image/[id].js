// pages/image/[id].js
// Build: 36.12_2025-08-20 + landing feature toggle
// Adds "Feature on landing" (public thumbnail pipeline) using public_gallery + public-thumbs.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

  // Load row
  useEffect(() => {
    if (!user?.id || !id) return;
    let canceled = false;
    setLoading(true);
    setStatus("Loading...");
    (async () => {
      const { data, error } = await supabase
        .from("image_metadata")
        .select(
          "id, user_id, path, storage_path, filename, ext, category, bleb_color, fiber_bundles_color, fibers_color, created_at, notes, uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in"
        )
        .eq("user_id", user.id)
        .eq("id", id)
        .single();

      if (canceled) return;

      if (error) {
        setStatus(`Load error: ${error.message}`);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data);
      setNotes(data?.notes || "");
      setStatus("");
      setLoading(false);

      // Check if featured
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

  // --- Landing "Feature" actions (public thumbnail pipeline) ---
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
      // 1) Download original from private bucket
      const sourcePath = row.path || row.storage_path;
      const { data: blob, error: dlErr } = await supabase.storage.from("images").download(sourcePath);
      if (dlErr) throw dlErr;

      // 2) Upload to public-thumbs under auth.uid()/image-<id>.<ext>
      const ext = (row.ext || "").replace(/^\./, "") || "jpg";
      const targetPath = `${user.id}/image-${row.id}.${ext}`;
      const { error: upErr } = await supabase
        .from("public-thumbs")
        .upload(targetPath, blob, { upsert: true, contentType: extToMime(ext) });
      if (upErr) throw upErr;

      // 3) Insert into public_gallery
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

      // 1) Delete storage object (safe delete order)
      const { error: delObjErr } = await supabase
        .from("public-thumbs")
        .remove([targetPath]);
      if (delObjErr && !/Not Found|does not exist/i.test(delObjErr.message)) {
        throw delObjErr;
      }

      // 2) Delete DB row
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

    // 1) Delete any public copy first
    try {
      const ext = (row.ext || "").replace(/^\./, "") || "jpg";
      const targetPath = `${user.id}/image-${row.id}.${ext}`;
      await supabase.from("public-thumbs").remove([targetPath]);
      await supabase.from("public_gallery").delete().eq("image_id", row.id);
    } catch {}

    // 2) Storage delete
    const removeRes = await supabase.storage.from("images").remove([row.path]);
    if (removeRes.error && !/Not Found|does not exist/i.test(removeRes.error.message)) {
      setStatus(`Storage delete error: ${removeRes.error.message}`);
      setDeleting(false);
      return;
    }

    // 3) Row delete
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

  function colorBadge() {
    if (!row) return null;
    if (row.category === "Blebs (clear to brown)" && row.bleb_color) return <Badge>Color: {row.bleb_color}</Badge>;
    if (row.category === "Fiber Bundles" && row.fiber_bundles_color) return <Badge>Color: {row.fiber_bundles_color}</Badge>;
    if (row.category === "Fibers" && row.fibers_color) return <Badge>Color: {row.fibers_color}</Badge>;
    return null;
  }

  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
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

            {/* Metadata + actions */}
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <Badge>{row.category || "Uncategorized"}</Badge>
                  {colorBadge()}
                </div>

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

                  {/* Feature toggle */}
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
                <h2 id="notes-heading" style={{ position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
                  Notes
                </h2>
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
        </>
      )}
    </main>
  );
}


