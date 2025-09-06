// Build: 36.7g_2025-08-19
// Rename category label to 'Blebs (clear to brown)'; colors/notes behavior unchanged
// Writes to image_metadata.path and saves optional notes/colors
// Small additions: overall upload status, “saving” step, 12s “Still waiting…” hint
// NEW: Tiny "Send feedback" mailto link in header (top-right)
// Microburst A (0905): Heading = "Uploads"; add top toolbar with Back to Home + Browse Gallery

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Feedback email (change if you prefer a different address)
const FEEDBACK_TO = "girlsaidwhat@gmail.com";
function feedbackHref(contextLabel = "Upload") {
  const subject = `${contextLabel} – Scope feedback`;
  const page = typeof window !== "undefined" ? window.location.href : "/upload";
  const body = `Page: ${page}\n\nWhat happened:\n`;
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Categories
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

const BLEBS_LABEL = "Blebs (clear to brown)";

// Color options
const BLEB_COLOR_OPTIONS = ["Clear", "Yellow", "Orange", "Red", "Brown"];
const FIBER_COLOR_OPTIONS = ["white/clear", "blue", "black", "red", "other"];

// File size limit in bytes (10 MB)
const MAX_BYTES = 10 * 1024 * 1024;

// Helpers
function extFromName(name = "") {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isValidImageType(file) {
  return file && (file.type === "image/jpeg" || file.type === "image/png");
}

function prettyBytes(n) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const [profileSnap, setProfileSnap] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [blebColor, setBlebColor] = useState("");
  const [fiberBundlesColor, setFiberBundlesColor] = useState("");
  const [fibersColor, setFibersColor] = useState("");
  const [notes, setNotes] = useState("");

  const [files, setFiles] = useState([]); // [{file, url}]
  const [rows, setRows] = useState([]); // per-file status rows
  const [isUploading, setIsUploading] = useState(false);

  // Overall status + “stuck” hint
  const [overallMsg, setOverallMsg] = useState("");
  const [hint, setHint] = useState("");
  const stuckTimerRef = useRef(null);

  const fileInputRef = useRef(null);

  // Load auth user
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

  // Load profile snapshot
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("initials, age, location, contact_opt_in")
        .eq("id", user.id) // keeping your existing key usage
        .maybeSingle();
      if (canceled) return;
      if (!error) setProfileSnap(data || null);
    })();
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, [files]);

  const isBlebs = selectedCategory === BLEBS_LABEL;
  const isFiberBundles = selectedCategory === "Fiber Bundles";
  const isFibers = selectedCategory === "Fibers";

  function resetStatuses(newFiles) {
    const newRows = newFiles.map((f) => ({
      name: f.file.name,
      size: f.file.size,
      type: f.file.type,
      url: f.url,
      progress: 0,
      state: "pending",
      message: "Ready to upload - click Upload",
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

  // Faux progress tickers
  const tickerRefs = useRef({});

  function startFauxProgress(idx) {
    stopFauxProgress(idx);
    tickerRefs.current[idx] = setInterval(() => {
      setRows((prev) => {
        const copy = [...prev];
        const r = { ...copy[idx] };
        if (r.progress < 90) r.progress += 1;
        copy[idx] = r;
        return copy;
      });
    }, 70);
  }

  function stopFauxProgress(idx) {
    const id = tickerRefs.current[idx];
    if (id) {
      clearInterval(id);
      delete tickerRefs.current[idx];
    }
  }

  // Stuck detector for long waits during upload/saving
  function startStuckTimer() {
    clearStuckTimer();
    stuckTimerRef.current = setTimeout(() => {
      setHint("Still waiting... Often a slow connection, a file over 10 MB, or a sign-in or session issue.");
    }, 12000);
  }
  function clearStuckTimer() {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }

  async function handleUpload(ev) {
    ev.preventDefault();
    if (!user?.id) {
      alert("Please sign in first.");
      return;
    }
    if (files.length === 0) {
      alert("Choose at least one file.");
      return;
    }

    // Client-side checks per file
    let anyRejected = false;
    const nextRowsA = rows.map((r, idx) => {
      const err = validateClientSide(files[idx].file);
      if (err) {
        anyRejected = true;
        return { ...r, state: "rejected", message: err, progress: 0 };
      }
      return { ...r, state: "pending", message: "Starting..." };
    });
    setRows(nextRowsA);
    if (anyRejected && nextRowsA.every((r) => r.state === "rejected")) {
      setOverallMsg("All files were rejected by checks.");
      setHint("");
      return;
    }

    setIsUploading(true);
    setOverallMsg("Uploading...");
    setHint("");
    startStuckTimer();

    // Map allowed rows once so we don’t rely on a stale state snapshot
    const allowed = nextRowsA.map((r) => r.state !== "rejected");

    // Upload each file sequentially
    for (let i = 0; i < files.length; i++) {
      if (!allowed[i]) continue;

      const f = files[i].file;

      // Start faux progress
      startFauxProgress(i);
      setRows((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], state: "uploading", message: "Uploading..." };
        return copy;
      });

      const path = `${user.id}/${f.name}`;

      // Upload to Storage
      const { error: upErr } = await supabase.storage
        .from("images")
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });

      if (upErr) {
        stopFauxProgress(i);
        const conflict =
          upErr?.statusCode === 409 ||
          upErr?.status === 409 ||
          /already exists|resource already exists|duplicate/i.test(upErr?.message || "");
        const friendly = conflict
          ? `A file named "${f.name}" already exists in your folder. Rename the file and try again. Nothing was uploaded for this file.`
          : `Upload failed: ${upErr.message || "Unknown error"}`;
        setRows((prev) => {
          const copy = [...prev];
          copy[i] = { ...copy[i], state: "error", message: friendly, progress: 0 };
          return copy;
        });
        continue;
      }

      // Show “saving” step
      setRows((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], state: "saving", message: "Saving metadata..." };
        return copy;
      });

      // Insert metadata row
      const meta = {
        user_id: user.id,
        path,
        filename: f.name,
        ext: extFromName(f.name),
        mime_type: f.type,
        size: f.size,
        category: selectedCategory,
        bleb_color: isBlebs ? (blebColor || null) : null,
        fiber_bundles_color: isFiberBundles ? (fiberBundlesColor || null) : null,
        fibers_color: isFibers ? (fibersColor || null) : null,
        notes: notes.trim() ? notes.trim() : null,
        uploader_initials: profileSnap?.initials ?? null,
        uploader_age: profileSnap?.age ?? null,
        uploader_location: profileSnap?.location ?? null,
        uploader_contact_opt_in: profileSnap?.contact_opt_in ?? null,
      };

      const { error: insErr } = await supabase.from("image_metadata").insert(meta);
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
              ? `Metadata insert failed: "path" column not found. Add it in Supabase, then retry.`
              : missingNotes
              ? `Metadata insert failed: "notes" column not found. Add it in Supabase, then retry.`
              : `Metadata insert failed: ${insErr.message}`,
            progress: 0,
          };
          return copy;
        });
        // Safe cleanup
        await supabase.storage.from("images").remove([path]);
        continue;
      }

      // Success
      stopFauxProgress(i);
      setRows((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], state: "success", message: "Uploaded and saved metadata.", progress: 100 };
        return copy;
      });
    }

    // Finish
    setIsUploading(false);
    clearStuckTimer();

    const ok = (r) => r.state === "success";
    const bad = (r) => r.state === "error" || r.state === "rejected";
    setRows((final) => {
      const s = final.filter(ok).length;
      const b = final.filter(bad).length;
      setOverallMsg(`Done. Success: ${s} • Issues: ${b}`);
      if (s === 0) setHint("If none succeeded, try a smaller JPEG or PNG, and confirm you are signed in.");
      return final;
    });
  }

  // Overall status derived on every change
  useEffect(() => {
    if (!rows.length) return;
    const uploading = rows.filter((r) => r.state === "uploading").length;
    const saving = rows.filter((r) => r.state === "saving").length;
    const success = rows.filter((r) => r.state === "success").length;
    const error = rows.filter((r) => r.state === "error" || r.state === "rejected").length;

    if (isUploading) {
      if (saving > 0) setOverallMsg(`Saving metadata (${saving})...`);
      else if (uploading > 0) setOverallMsg(`Uploading (${uploading})...`);
    } else if (success + error > 0) {
      setOverallMsg(`Done. Success: ${success} • Issues: ${error}`);
    }
    if (success + error > 0) clearStuckTimer();
  }, [rows, isUploading]);

  const totalCountText = useMemo(() => {
    const ok = rows.filter((r) => r.state === "success").length;
    const fail = rows.filter((r) => r.state === "error" || r.state === "rejected").length;
    return ok + fail > 0 ? `Done. Success: ${ok} • Issues: ${fail}` : "";
  }, [rows]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
      {/* Top toolbar */}
      <nav aria-label="Uploads page navigation" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <a
          href="/"
          aria-label="Back to Home"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e5e5", textDecoration: "none" }}
        >
          <span aria-hidden="true">←</span>
          <span>Back to Home</span>
        </a>
        <a
          href="/browse"
          aria-label="Browse Gallery"
          style={{ fontSize: 14, textDecoration: "underline" }}
        >
          Browse Gallery
        </a>
      </nav>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Uploads</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href={feedbackHref("Uploads")}
            aria-label="Send feedback about the Uploads page"
            style={{ fontSize: 12, textDecoration: "underline" }}
          >
            Send feedback
          </a>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Build: 36.7g_2025-08-19</div>
        </div>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Please sign in to upload.
        </div>
      ) : (
        <form onSubmit={handleUpload}>
          {/* Category */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Category</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val);
                if (val !== BLEBS_LABEL) setBlebColor("");
                if (val !== "Fiber Bundles") setFiberBundlesColor("");
                if (val !== "Fibers") setFibersColor("");
              }}
              style={{ width: "100%", padding: "8px" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* Color pickers */}
          {isBlebs && (
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Bleb Color (optional)</span>
              <select
                value={blebColor}
                onChange={(e) => setBlebColor(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Choose color (optional)</option>
                {BLEB_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          )}

          {isFiberBundles && (
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Fiber Bundles Color (optional)</span>
              <select
                value={fiberBundlesColor}
                onChange={(e) => setFiberBundlesColor(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Choose color (optional)</option>
                {FIBER_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          )}

          {isFibers && (
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Fibers Color (optional)</span>
              <select
                value={fibersColor}
                onChange={(e) => setFibersColor(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Choose color (optional)</option>
                {FIBER_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          )}

          {/* Notes */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Notes (optional) - saved to each file in this batch
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any details about this batch. Example: microscope settings, date taken, lighting, context."
              style={{ width: "100%", padding: "8px", resize: "vertical" }}
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

          {/* Overall status line */}
          <p aria-live="polite" style={{ margin: "6px 0 12px", minHeight: 18, fontSize: 13 }}>
            {overallMsg}
          </p>
          {hint ? <p style={{ margin: "-6px 0 12px", fontSize: 12, color: "#6b7280" }}>{hint}</p> : null}

          {/* Selected files list */}
          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {rows.map((r, idx) => (
                <div key={idx} style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: 10,
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  marginBottom: 8,
                }}>
                  <img src={r.url} alt={r.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                      {r.type} • {prettyBytes(r.size)}
                    </div>
                    <div style={{
                      height: 6,
                      background: "#f3f3f3",
                      borderRadius: 4,
                      overflow: "hidden",
                      marginBottom: 6,
                    }} aria-label="Upload progress">
                      <div style={{
                        width: `${r.progress}%`,
                        height: "100%",
                        background: r.state === "success" ? "#22c55e" : "#3b82f6",
                        transition: "width 120ms linear",
                      }} />
                    </div>
                    <div style={{
                      fontSize: 13,
                      color:
                        r.state === "error" || r.state === "rejected"
                          ? "#b91c1c"
                          : r.state === "success"
                          ? "#065f46"
                          : "#374151",
                    }}>
                      {r.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={!user || files.length === 0 || isUploading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: isUploading ? "#8dd3cd" : "#14b8a6",
                color: "white",
                cursor: isUploading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.value && (fileInputRef.current.value = "");
                files.forEach((f) => URL.revokeObjectURL(f.url));
                setFiles([]);
                setRows([]);
                setOverallMsg("");
                setHint("");
              }}
              disabled={isUploading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                background: "white",
                cursor: isUploading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          </div>

          {totalCountText && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>{totalCountText}</div>
          )}
        </form>
      )}
    </div>
  );
}
