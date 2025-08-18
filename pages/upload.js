// pages/upload.js
// The Scope of Morgellons — Upload (Batch uploads + thumbnails)
// Build: 36.4e_2025-08-18

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CATEGORIES = [
  { value: "biofilm", label: "Biofilm" },
  { value: "clear_to_brown_blebs", label: 'Clear--Brown "Blebs"' },
  { value: "fiber_bundles", label: "Fiber Bundles" },
  { value: "fibers", label: "Fibers" },
  { value: "hexagons", label: "Hexagons" },
  { value: "crystalline_structures", label: "Crystalline Structures" },
  { value: "feathers", label: "Feathers" },
  { value: "miscellaneous", label: "Miscellaneous" },
];
const BLEB_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];

const Status = ({ kind = "info", children }) => {
  const color =
    kind === "error" ? "#b91c1c" : kind === "success" ? "#065f46" : "#374151";
  const bg =
    kind === "error" ? "#fee2e2" : kind === "success" ? "#d1fae5" : "#e5e7eb";
  return (
    <div style={{ background: bg, color, padding: "8px 10px", borderRadius: 8, fontSize: 14, marginTop: 8, whiteSpace: "pre-wrap" }}>
      {children}
    </div>
  );
};

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ initials: "", age: "", location: "", contact_opt_in: false });

  const fileInputRef = useRef(null);

  const [selectedCategory, setSelectedCategory] = useState("miscellaneous");
  const [blebColor, setBlebColor] = useState("");

  // Per-file state items:
  // { name, size, type, progress, status, msg, previewUrl, finalUrl }
  const [filesState, setFilesState] = useState([]);
  const [overallStatus, setOverallStatus] = useState({ type: "info", msg: "" });

  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png"];

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const currentUser = auth?.user || null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        const { data } = await supabase
          .from("user_profile")
          .select("initials, age, location, contact_opt_in")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (data) {
          setProfile({
            initials: data.initials ?? "",
            age: data.age ?? "",
            location: data.location ?? "",
            contact_opt_in: !!data.contact_opt_in,
          });
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Faux progress helpers
  function startFauxProgress(idx) {
    let pct = 0;
    const id = setInterval(() => {
      pct = Math.min(pct + Math.random() * 10 + 5, 90);
      setFilesState((prev) => {
        const copy = [...prev];
        if (!copy[idx]) return prev;
        copy[idx] = { ...copy[idx], progress: Math.floor(pct) };
        return copy;
      });
    }, 350);
    return id;
  }

  const signedIn = useMemo(() => Boolean(user?.id), [user]);
  const isBlebCategory = selectedCategory === "clear_to_brown_blebs";
  const uploadingAny = filesState.some((f) => f.status === "uploading");

  async function handleUpload(e) {
    e.preventDefault();
    setOverallStatus({ type: "info", msg: "" });

    if (!user) {
      setOverallStatus({ type: "error", msg: "You must be signed in." });
      return;
    }
    const picked = Array.from(fileInputRef.current?.files || []);
    if (picked.length === 0) {
      setOverallStatus({ type: "error", msg: "Choose at least one JPEG or PNG under 10 MB." });
      return;
    }

    // Initialize per-file state with local previews
    const initial = picked.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      progress: 0,
      status: "queued", // queued | uploading | success | error | skipped
      msg: "",
      previewUrl: URL.createObjectURL(f),
      finalUrl: "",
    }));
    setFilesState(initial);

    // Process sequentially
    let successCount = 0;
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];

      // Validate client-side
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFilesState((prev) => {
          const copy = [...prev];
          copy[i] = { ...copy[i], status: "error", msg: "Only JPEG or PNG files are allowed." };
          return copy;
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        setFilesState((prev) => {
          const copy = [...prev];
          copy[i] = { ...copy[i], status: "error", msg: "File is larger than 10 MB." };
          return copy;
        });
        continue;
      }

      const path = `${user.id}/${file.name}`;
      setFilesState((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], status: "uploading", msg: "" };
        return copy;
      });

      const fauxId = startFauxProgress(i);

      // Step 1: storage upload
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        clearInterval(fauxId);
        setFilesState((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            status: "error",
            progress: 0,
            msg: "Upload failed. Try another image or filename.",
          };
          return copy;
        });
        continue; // move to next file
      }

      // Step 2: metadata insert
      const blebColorValue = isBlebCategory ? (blebColor || null) : null;

      const { error: metaError } = await supabase.from("image_metadata").insert([{
        user_id: user.id,
        bucket: "images",
        path,
        filename: file.name,
        category: selectedCategory,
        bleb_color: blebColorValue,
        uploader_initials: profile.initials?.trim() || null,
        uploader_age: profile.age === "" ? null : Number(profile.age),
        uploader_location: profile.location?.trim() || null,
        uploader_contact_opt_in: !!profile.contact_opt_in,
      }]);

      clearInterval(fauxId);

      if (metaError) {
        const details = [metaError.message, metaError.details, metaError.hint, metaError.code ? `code: ${metaError.code}` : null]
          .filter(Boolean).join(" | ");
        setFilesState((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            status: "error",
            progress: 0,
            msg: "Upload stored, but metadata insert failed. " + details,
          };
          return copy;
        });
        continue;
      }

      // Success: get a public URL so the preview persists
      const { data: pub } = supabase.storage.from("images").getPublicUrl(path);
      const finalUrl = pub?.publicUrl || "";

      successCount += 1;
      setFilesState((prev) => {
        const copy = [...prev];
        copy[i] = {
          ...copy[i],
          status: "success",
          progress: 100,
          msg: "Upload successful. Metadata saved.",
          finalUrl,
        };
        return copy;
      });
    }

    // Clear file picker so user can select more
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Summary status
    const total = picked.length;
    if (successCount === total) {
      setOverallStatus({ type: "success", msg: `All ${total}/${total} uploads completed.` });
    } else if (successCount === 0) {
      setOverallStatus({ type: "error", msg: `No files completed. Check messages for each file.` });
    } else {
      setOverallStatus({ type: "info", msg: `${successCount}/${total} uploads completed. Check messages for any that failed.` });
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Upload Images</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.4e_2025-08-18</div>
      </header>

      <nav style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>← Back to Profile</Link>
        <Link href="/browse" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>Browse</Link>
      </nav>

      {!signedIn ? (
        <Status kind="info">Sign in to upload.</Status>
      ) : (
        <div style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
          Snapshot in use: {profile.initials || "(no initials)"} {profile.age ? `• Age ${profile.age}` : ""} {profile.location ? `• ${profile.location}` : ""} {profile.contact_opt_in ? "• Open to contact" : ""}
        </div>
      )}

      <section style={{ marginTop: 16 }}>
        <form onSubmit={handleUpload} style={cardStyle()}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle()}>Category</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={inputStyle()}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {isBlebCategory ? (
              <div>
                <label style={labelStyle()}>Bleb Color</label>
                <select value={blebColor} onChange={(e) => setBlebColor(e.target.value)} style={inputStyle()}>
                  <option value="">(Optional) Select a color</option>
                  {BLEB_COLORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label style={labelStyle()}>Choose images (JPEG or PNG, max 10 MB each)</label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple style={inputStyle()} />
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" disabled={!signedIn || uploadingAny} style={buttonStyle(!signedIn || uploadingAny)}>
              {uploadingAny ? "Uploading…" : "Start Uploads"}
            </button>
          </div>

          {overallStatus.msg ? (
            <Status kind={overallStatus.type}>{overallStatus.msg}</Status>
          ) : (
            <Status kind="info">Each file shows its own progress, message, and thumbnail.</Status>
          )}
        </form>

        {/* Per-file statuses with thumbnails */}
        {filesState.length > 0 ? (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {filesState.map((f, idx) => (
              <div key={`${f.name}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#f3f4f6",
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {(f.finalUrl || f.previewUrl) ? (
                      <img
                        src={f.finalUrl || f.previewUrl}
                        alt={f.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <div
                        style={{ fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={f.name}
                      >
                        {f.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{f.status}</div>
                    </div>

                    <div style={{ marginTop: 8, height: 10, background: "#e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${f.progress}%`, background: "#2563eb", transition: "width 200ms linear" }} />
                    </div>

                    {f.msg ? (
                      <div style={{ marginTop: 8 }}>
                        <Status kind={f.status === "success" ? "success" : f.status === "error" ? "error" : "info"}>
                          {f.msg}
                        </Status>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

// Styles
function cardStyle() { return { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }; }
function inputStyle() { return { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }; }
function labelStyle() { return { display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }; }
function buttonStyle(disabled) { return { background: disabled ? "#9ca3af" : "#111827", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", fontSize: 14, cursor: disabled ? "not-allowed" : "pointer" }; }
