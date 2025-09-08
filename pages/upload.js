// pages/upload.js
// Multi-category upload with multi-select Category and conditional multi-select Colors for Blebs/Fibers.
// Keeps 10MB limit, faux progress, notes, and per-file status. Sign out sits under Send feedback.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Feedback email
const FEEDBACK_TO = "girlsaidwhat@gmail.com";
function feedbackHref(contextLabel = "Upload") {
  const subject = `${contextLabel} – Report`;
  const page = typeof window !== "undefined" ? window.location.href : "/upload";
  const body = `Page: ${page}\n\nWhat happened:\n`;
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Taxonomy (requested names/order; “Other” last)
const CATEGORIES = [
  "Blebs (clear to brown)",
  "Spiky Biofilm",
  "Biofilm",
  "Fiber Bundles",
  "Fibers",
  "Hexagons",
  "Crystalline Structures",
  "Feathers",
  "Hairs",
  "Skin",
  "Lesions",
  "Embedded Fibers",
  "Embedded Artifacts",
  "Spiral Artifacts",
  "Fire Hair",
  "Fire Skin",
  "Sparkle Skin",
  "Other",
];

const BLEBS_LABEL = "Blebs (clear to brown)";
const FIBERS_LABEL = "Fibers";

const MAX_BYTES = 10 * 1024 * 1024;
const BLEB_COLOR_OPTIONS = ["Clear", "Yellow", "Orange", "Red", "Brown"];
const FIBER_COLOR_OPTIONS = ["white/clear", "blue", "black", "red", "other"];

function extFromName(name = "") {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}
function isValidImageType(file) {
  return file && (file.type === "image/jpeg" || file.type === "image/png");
}
function prettyBytes(n) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024; if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024; return `${mb.toFixed(2)} MB`;
}

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const [profileSnap, setProfileSnap] = useState(null);

  // Category multi-select
  const [selectedCats, setSelectedCats] = useState([]);
  const isBlebs = selectedCats.includes(BLEBS_LABEL);
  const isFibers = selectedCats.includes(FIBERS_LABEL);

  // Multi-select colors when relevant
  const [blebColors, setBlebColors] = useState([]);     // array of strings
  const [fiberColors, setFiberColors] = useState([]);   // array of strings

  // Notes (applied to each file in batch)
  const [notes, setNotes] = useState("");

  const [files, setFiles] = useState([]); // [{file, url}]
  const [rows, setRows] = useState([]);   // status rows
  const [isUploading, setIsUploading] = useState(false);
  const [overallMsg, setOverallMsg] = useState("");
  const [hint, setHint] = useState("");
  const stuckTimerRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Profile snapshot (by user_id)
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("initials, age, location, contact_opt_in")
        .eq("user_id", user.id)
        .maybeSingle();
      if (canceled) return;
      if (!error) setProfileSnap(data || null);
    })();
    return () => { canceled = true; };
  }, [user?.id]);

  // Clean up URLs
  useEffect(() => () => { files.forEach((f) => URL.revokeObjectURL(f.url)); }, [files]);

  function resetStatuses(newFiles) {
    const newRows = newFiles.map((f) => ({
      name: f.file.name, size: f.file.size, type: f.file.type, url: f.url,
      progress: 0, state: "pending", message: "Ready to upload - click Upload",
    }));
    setRows(newRows);
    setOverallMsg(newFiles.length ? "Ready. Click Upload to begin." : "");
    setHint("");
  }

  function onChooseFiles(ev) {
    const list = Array.from(ev.target.files || []);
    const prepared = list.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles(prepared);
    resetStatuses(prepared);
  }

  function validateClientSide(file) {
    if (!isValidImageType(file)) return "Only JPEG or PNG files are allowed.";
    if (file.size > MAX_BYTES) return `File is too large. Limit is 10 MB. This file is ${prettyBytes(file.size)}.`;
    return null;
  }

  // Faux progress
  const tickerRefs = useRef({});
  function startFauxProgress(idx) {
    stopFauxProgress(idx);
    tickerRefs.current[idx] = setInterval(() => {
      setRows((prev) => {
        const copy = [...prev]; const r = { ...copy[idx] };
        if (r.progress < 90) r.progress += 1;
        copy[idx] = r; return copy;
      });
    }, 70);
  }
  function stopFauxProgress(idx) {
    const id = tickerRefs.current[idx];
    if (id) { clearInterval(id); delete tickerRefs.current[idx]; }
  }

  function startStuckTimer() {
    clearStuckTimer();
    stuckTimerRef.current = setTimeout(() => {
      setHint("Still waiting... Often a slow connection, a file over 10 MB, or a sign-in or session issue.");
    }, 12000);
  }
  function clearStuckTimer() { if (stuckTimerRef.current) { clearTimeout(stuckTimerRef.current); stuckTimerRef.current = null; } }

  function onChangeMultiSelect(setter) {
    return (e) => {
      const opts = Array.from(e.target.selectedOptions || []).map((o) => o.value);
      setter(opts);
    };
  }

  function onChangeCategories(e) {
    const opts = Array.from(e.target.selectedOptions || []).map((o) => o.value);
    setSelectedCats(opts);
    // Clear colors if category deselected
    if (!opts.includes(BLEBS_LABEL)) setBlebColors([]);
    if (!opts.includes(FIBERS_LABEL)) setFiberColors([]);
  }

  async function handleUpload(ev) {
    ev.preventDefault();
    if (!user?.id) { alert("Please sign in first."); return; }
    if (files.length === 0) { alert("Choose at least one file."); return; }

    // Client checks
    let anyRejected = false;
    const nextRowsA = rows.map((r, idx) => {
      const err = validateClientSide(files[idx].file);
      if (err) { anyRejected = true; return { ...r, state: "rejected", message: err, progress: 0 }; }
      return { ...r, state: "pending", message: "Starting..." };
    });
    setRows(nextRowsA);
    if (anyRejected && nextRowsA.every((r) => r.state === "rejected")) {
      setOverallMsg("All files were rejected by checks."); setHint(""); return;
    }

    setIsUploading(true); setOverallMsg("Uploading..."); setHint(""); startStuckTimer();

    const allowed = nextRowsA.map((r) => r.state !== "rejected");
    const trimmedCats = Array.from(new Set(selectedCats.map((c) => (c || "").trim()).filter(Boolean)));
    const primaryCategory = trimmedCats[0] || null;

    for (let i = 0; i < files.length; i++) {
      if (!allowed[i]) continue;
      const f = files[i].file;

      startFauxProgress(i);
      setRows((prev) => { const copy = [...prev]; copy[i] = { ...copy[i], state: "uploading", message: "Uploading..." }; return copy; });

      const storagePath = `${user.id}/${f.name}`;
      const { error: upErr } = await supabase
        .storage
        .from("images")
        .upload(storagePath, f, { cacheControl: "3600", upsert: false, contentType: f.type });

      if (upErr) {
        stopFauxProgress(i);
        const conflict =
          upErr?.statusCode === 409 || upErr?.status === 409 || /already exists|resource already exists|duplicate/i.test(upErr?.message || "");
        const friendly = conflict
          ? `A file named "${f.name}" already exists in your folder. Rename the file and try again. Nothing was uploaded for this file.`
          : `Upload failed: ${upErr.message || "Unknown error"}`;
        setRows((prev) => { const copy = [...prev]; copy[i] = { ...copy[i], state: "error", message: friendly, progress: 0 }; return copy; });
        continue;
      }

      setRows((prev) => { const copy = [...prev]; copy[i] = { ...copy[i], state: "saving", message: "Saving metadata..." }; return copy; });

      // Insert metadata (legacy-safe); arrays/colors updated after insert (tolerant)
      const meta = {
        user_id: user.id,
        storage_path: storagePath, // prefer "storage_path"
        path: storagePath,         // legacy fallback if only "path" exists
        filename: f.name,
        ext: extFromName(f.name),
        mime_type: f.type,
        size: f.size,
        category: primaryCategory, // back-compat single category
        bleb_color: isBlebs ? (blebColors[0] || null) : null, // legacy single color (first)
        fibers_color: isFibers ? (fiberColors.join(", ") || null) : null, // legacy single field with joined values
        notes: notes.trim() ? notes.trim() : null,
        uploader_initials: profileSnap?.initials ?? null,
        uploader_age: profileSnap?.age ?? null,
        uploader_location: profileSnap?.location ?? null,
        uploader_contact_opt_in: profileSnap?.contact_opt_in ?? null,
      };

      const { data: insData, error: insErr } = await supabase
        .from("image_metadata")
        .insert(meta)
        .select("id")
        .single();

      if (insErr) {
        stopFauxProgress(i);
        const missingPath = /column .*path.* does not exist/i.test(insErr.message || "");
        const missingNotes = /column .*notes.* does not exist/i.test(insErr.message || "");
        setRows((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            state: "error",
            message: missingPath
              ? `Metadata insert failed: "path"/"storage_path" column not found. Add it in Supabase, then retry.`
              : missingNotes
              ? `Metadata insert failed: "notes" column not found. Add it in Supabase, then retry.`
              : `Metadata insert failed: ${insErr.message}`,
            progress: 0,
          };
          return copy;
        });
        // Roll back storage object if insert failed
        await supabase.storage.from("images").remove([storagePath]);
        continue;
      }

      const imageId = insData.id;

      // Insert category mappings (ignore table-missing errors gracefully)
      try {
        if (trimmedCats.length) {
          const payload = trimmedCats.map((c) => ({ image_id: imageId, user_id: user.id, category: c }));
          const { error: mapErr } = await supabase.from("image_category_map").insert(payload);
          if (mapErr && !(mapErr.message || "").toLowerCase().includes("does not exist")) {
            console.warn("image_category_map insert error:", mapErr.message);
          }
        }
      } catch (e) {
        console.warn("image_category_map insert exception:", e?.message || e);
      }

      // Try to persist arrays (tolerant if columns do not exist)
      async function tolerantUpdate(col, val) {
        try {
          const { error } = await supabase.from("image_metadata").update({ [col]: val }).eq("id", imageId);
          if (error) {
            const msg = (error.message || "").toLowerCase();
            const ignorable =
              msg.includes("does not exist") ||
              msg.includes("unknown") && msg.includes("column") ||
              msg.includes("column") && msg.includes("not found");
            if (!ignorable) console.warn(`Update error for ${col}:`, error.message);
          }
        } catch (e) {
          // ignore
        }
      }

      if (isBlebs && blebColors.length) {
        await tolerantUpdate("bleb_colors", blebColors); // new array column if present
      }
      if (trimmedCats.length) {
        await tolerantUpdate("categories", trimmedCats); // new array column if present
      }

      stopFauxProgress(i);
      setRows((prev) => { const copy = [...prev]; copy[i] = { ...copy[i], state: "success", message: "Uploaded and saved metadata.", progress: 100 }; return copy; });
    }

    setIsUploading(false);
    clearStuckTimer();

    setRows((final) => {
      const s = final.filter((r) => r.state === "success").length;
      const b = final.filter((r) => r.state === "error" || r.state === "rejected").length;
      setOverallMsg(`Done. Success: ${s} • Issues: ${b}`);
      if (s === 0) setHint("If none succeeded, try a smaller JPEG or PNG, and confirm you are signed in.");
      return final;
    });
  }

  const totalCountText = useMemo(() => {
    const ok = rows.filter((r) => r.state === "success").length;
    const fail = rows.filter((r) => r.state === "error" || r.state === "rejected").length;
    return ok + fail > 0 ? `Done. Success: ${ok} • Issues: ${fail}` : "";
  }, [rows]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      // soft redirect home
      if (typeof window !== "undefined") window.location.href = "/";
    } catch {}
  }

  return (
    <main id="main" style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
      {/* Header: Back link left; right column has feedback with sign out directly under it */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <a href="/" style={{ textDecoration: "none" }}>← <strong>Back to Profile</strong></a>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <a
            href={feedbackHref("Upload")}
            aria-label="Send feedback about the Upload page"
            style={{ fontSize: 12, textDecoration: "underline", color: "#334155" }}
          >
            Send feedback
          </a>
          {user ? (
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                cursor: "pointer",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Please sign in to upload.
        </div>
      ) : (
        <form onSubmit={handleUpload} aria-label="Upload images">
          {/* Category (multi-select dropdown) */}
          <label style={{ display: "block", marginBottom: 10 }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Category</span>
            <select
              aria-label="Category"
              multiple
              size={Math.min(8, CATEGORIES.length)}
              value={selectedCats}
              onChange={onChangeCategories}
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              You can select more than one. The first selected is used as the primary category for now.
            </div>
          </label>

          {/* Conditional color pickers (multi-select) */}
          {isBlebs && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Bleb Color (optional)</span>
              <select
                aria-label="Bleb Color (optional)"
                multiple
                size={BLEB_COLOR_OPTIONS.length}
                value={blebColors}
                onChange={onChangeMultiSelect(setBlebColors)}
                style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
              >
                {BLEB_COLOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}

          {isFibers && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Fiber Color (optional)</span>
              <select
                aria-label="Fiber Color (optional)"
                multiple
                size={Math.min(6, FIBER_COLOR_OPTIONS.length)}
                value={fiberColors}
                onChange={onChangeMultiSelect(setFiberColors)}
                style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
              >
                {FIBER_COLOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}

          {/* Notes */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Notes (optional) — saved to each file (or batch)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any details about this batch. Example: microscope settings, date taken, lighting, context."
              style={{ width: "100%", padding: "8px", resize: "vertical", borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>

          {/* File input */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Select images (JPEG or PNG, up to 10 MB each)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={(e) => onChooseFiles(e)}
            />
          </label>

          {/* Overall status + hint */}
          <p aria-live="polite" style={{ margin: "6px 0 12px", minHeight: 18, fontSize: 13 }}>{overallMsg}</p>
          {hint ? <p style={{ margin: "-6px 0 12px", fontSize: 12, color: "#6b7280" }}>{hint}</p> : null}

          {/* Selected files list */}
          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {rows.map((r, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center", padding: 10, border: "1px solid #e5e5e5", borderRadius: 8, marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{r.type} • {prettyBytes(r.size)}</div>
                    <div style={{ height: 6, background: "#f3f3f3", borderRadius: 4, overflow: "hidden", marginBottom: 6 }} aria-label="Upload progress">
                      <div style={{ width: `${r.progress}%`, height: "100%", background: r.state === "success" ? "#22c55e" : "#3b82f6", transition: "width 120ms linear" }} />
                    </div>
                    <div style={{ fontSize: 13, color: (r.state === "error" || r.state === "rejected") ? "#b91c1c" : (r.state === "success" ? "#065f46" : "#374151") }}>
                      {r.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={!user || files.length === 0 || isUploading}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #0f766e", background: isUploading ? "#8dd3cd" : "#14b8a6", color: "white", cursor: isUploading ? "not-allowed" : "pointer", fontWeight: 600 }}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = "";
                files.forEach((f) => URL.revokeObjectURL(f.url));
                setFiles([]); setRows([]); setOverallMsg(""); setHint("");
              }}
              disabled={isUploading}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e5e5", background: "white", cursor: isUploading ? "not-allowed" : "pointer", fontWeight: 600 }}
            >
              Clear
            </button>
          </div>

          {totalCountText && <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>{totalCountText}</div>}
        </form>
      )}
    </main>
  );
}
