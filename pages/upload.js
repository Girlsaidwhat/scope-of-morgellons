// Build: 36.7b_2025-08-19
// Upload page with batch Notes (optional) saved to public.image_metadata.notes
// Bleb color selector is hidden unless Blebs category is selected.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Categories and Blebs color options
const CATEGORIES = [
  'Clear--Brown "Blebs"',
  "Biofilm",
  "Fiber Bundles",
  "Fibers",
  "Hexagons",
  "Crystalline Structures",
  "Feathers",
  "Miscellaneous",
];

const BLEB_COLOR_OPTIONS = ["Clear", "Yellow", "Orange", "Red", "Brown"];
const BLEBS_LABEL = 'Clear--Brown "Blebs"';

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
  const [notes, setNotes] = useState("");

  const [files, setFiles] = useState([]); // [{file, url}]
  const [rows, setRows] = useState([]); // per-file status rows
  const [isUploading, setIsUploading] = useState(false);

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

  // Load profile snapshot once user is ready
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("initials, age, location, contact_opt_in")
        .eq("id", user.id)
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

  function resetStatuses(newFiles) {
    const newRows = newFiles.map((f) => ({
      name: f.file.name,
      size: f.file.size,
      type: f.file.type,
      url: f.url,
      progress: 0,
      state: "pending", // pending | uploading | success | error | rejected
      message: "Waiting",
    }));
    setRows(newRows);
  }

  function onChooseFiles(ev) {
    const list = Array.from(ev.target.files || []);
    const prepared = list.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles(prepared);
    resetStatuses(prepared);
  }

  function validateClientSide(file) {
    if (!isValidImageType(file)) {
      return "Only JPEG or PNG files are allowed.";
    }
    if (file.size > MAX_BYTES) {
      return `File is too large. Limit is 10 MB. This file is ${prettyBytes(file.size)}.`;
    }
    return null;
  }

  // Faux progress tickers kept here so we can clear them
  const tickerRefs = useRef({}); // key: index -> intervalId

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

    // Optional color notice for Blebs
    if (isBlebs && blebColor === "") {
      const ok = confirm(
        'You selected the Blebs category without a color. Continue without a color?'
      );
      if (!ok) return;
    }

    // Client-side checks per file
    let anyRejected = false;
    const nextRowsA = rows.map((r, idx) => {
      const err = validateClientSide(files[idx].file);
      if (err) {
        anyRejected = true;
        return { ...r, state: "rejected", message: err, progress: 0 };
      }
      return { ...r, state: "pending", message: "Ready" };
    });
    setRows(nextRowsA);
    if (anyRejected && nextRowsA.every((r) => r.state === "rejected")) return;

    setIsUploading(true);

    // Prepare static metadata shared across the batch
    const shared = {
      category: selectedCategory,
      bleb_color: isBlebs ? (blebColor || null) : null,
      notes: notes.trim() ? notes.trim() : null,
      uploader_initials: profileSnap?.initials ?? null,
      uploader_age: profileSnap?.age ?? null,
      uploader_location: profileSnap?.location ?? null,
      uploader_contact_opt_in: profileSnap?.contact_opt_in ?? null,
    };

    // Upload each file sequentially to keep messages simple
    for (let i = 0; i < files.length; i++) {
      const f = files[i].file;
      if (rows[i].state === "rejected") continue;

      // Start faux progress
      startFauxProgress(i);
      setRows((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], state: "uploading", message: "Uploading..." };
        return copy;
      });

      const path = `${user.id}/${f.name}`;

      // Upload the file to Storage
      const { error: upErr } = await supabase.storage
        .from("images")
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });

      if (upErr) {
        stopFauxProgress(i);
        // Duplicate filename friendly message
        const conflict =
          upErr?.statusCode === 409 ||
          upErr?.status === 409 ||
          /already exists|resource already exists|duplicate/i.test(upErr?.message || "");

        const friendly = conflict
          ? `A file named "${f.name}" already exists in your folder. Rename the file and try again. Nothing was uploaded for this file.`
          : `Upload failed: ${upErr.message || "Unknown error"}`;

        setRows((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            state: "error",
            message: friendly,
            progress: 0,
          };
          return copy;
        });
        continue;
      }

      // Insert metadata row
      const meta = {
        user_id: user.id,
        storage_path: path,
        filename: f.name,
        ext: extFromName(f.name),
        mime_type: f.type,
        size: f.size,
        category: shared.category,
        bleb_color: shared.bleb_color,
        notes: shared.notes,
        uploader_initials: shared.uploader_initials,
        uploader_age: shared.uploader_age,
        uploader_location: shared.uploader_location,
        uploader_contact_opt_in: shared.uploader_contact_opt_in,
      };

      const { error: insErr } = await supabase.from("image_metadata").insert(meta);
      if (insErr) {
        stopFauxProgress(i);
        const missingNotes = /column .*notes.* does not exist/i.test(insErr.message || "");
        const missingStoragePath = /column .*storage_path.* does not exist/i.test(insErr.message || "");
        setRows((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            state: "error",
            message: missingNotes
              ? `Metadata insert failed: "notes" column not found. Add it in Supabase, then retry.`
              : missingStoragePath
              ? `Metadata insert failed: "storage_path" column not found. Add it in Supabase, then retry.`
              : `Metadata insert failed: ${insErr.message}`,
            progress: 0,
          };
          return copy;
        });
        // Attempt to remove the just-uploaded file to avoid orphaned files
        await supabase.storage.from("images").remove([path]);
        continue;
      }

      // Success
      stopFauxProgress(i);
      setRows((prev) => {
        const copy = [...prev];
        copy[i] = {
          ...copy[i],
          state: "success",
          message: "Uploaded and saved metadata.",
          progress: 100,
        };
        return copy;
      });
    }

    setIsUploading(false);
  }

  const totalCountText = useMemo(() => {
    const ok = rows.filter((r) => r.state === "success").length;
    const fail = rows.filter((r) => r.state === "error" || r.state === "rejected").length;
    return ok + fail > 0 ? `Done. Success: ${ok} • Issues: ${fail}` : "";
  }, [rows]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Upload</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Build: 36.7b_2025-08-19</div>
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
                setSelectedCategory(e.target.value);
                if (e.target.value !== BLEBS_LABEL) setBlebColor("");
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

          {/* Bleb color only when Blebs selected */}
          {isBlebs && (
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                Bleb Color (optional)
              </span>
              <select
                value={blebColor}
                onChange={(e) => setBlebColor(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">No color</option>
                {BLEB_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Notes - batch level */}
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
              onChange={onChooseFiles}
            />
          </label>

          {/* Selected files list with thumbnails and statuses */}
          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {rows.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr",
                    gap: 12,
                    alignItems: "center",
                    padding: 10,
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <img
                    src={r.url}
                    alt={r.name}
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                      {r.type} • {prettyBytes(r.size)}
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#f3f3f3",
                        borderRadius: 4,
                        overflow: "hidden",
                        marginBottom: 6,
                      }}
                      aria-label="Upload progress"
                    >
                      <div
                        style={{
                          width: `${r.progress}%`,
                          height: "100%",
                          background: r.state === "success" ? "#22c55e" : "#3b82f6",
                          transition: "width 120ms linear",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color:
                          r.state === "error" || r.state === "rejected"
                            ? "#b91c1c"
                            : r.state === "success"
                            ? "#065f46"
                            : "#374151",
                      }}
                    >
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
