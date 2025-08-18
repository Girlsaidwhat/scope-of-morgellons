// pages/upload.js
// The Scope of Morgellons — Upload
// Build: 36.4b_2025-08-18

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
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: "info", msg: "" });

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

  // Faux progress
  useEffect(() => {
    if (!uploading) return;
    setProgress(0);
    let pct = 0;
    const id = setInterval(() => {
      pct = Math.min(pct + Math.random() * 10 + 5, 90);
      setProgress(Math.floor(pct));
    }, 350);
    return () => clearInterval(id);
  }, [uploading]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!user) {
      setUploadStatus({ type: "error", msg: "You must be signed in." });
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadStatus({ type: "error", msg: "Choose a JPEG or PNG under 10 MB." });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadStatus({ type: "error", msg: "Only JPEG or PNG files are allowed." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadStatus({ type: "error", msg: "File is larger than 10 MB." });
      return;
    }

    setUploadStatus({ type: "info", msg: "" });
    setUploading(true);

    const path = `${user.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setProgress(0);
      setUploadStatus({ type: "error", msg: "Upload failed. Please try another image or filename." });
      return;
    }

    const blebColorValue = selectedCategory === "clear_to_brown_blebs" ? (blebColor || null) : null;

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

    setUploading(false);
    setProgress(100);

    if (metaError) {
      const details = [metaError.message, metaError.details, metaError.hint, metaError.code ? `code: ${metaError.code}` : null]
        .filter(Boolean).join("\n");
      setUploadStatus({ type: "error", msg: "Upload stored, but metadata insert failed.\n" + details });
      return;
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setBlebColor("");
    setUploadStatus({ type: "success", msg: "Upload successful. Metadata saved." });
  }

  const signedIn = useMemo(() => Boolean(user?.id), [user]);
  const isBlebCategory = selectedCategory === "clear_to_brown_blebs";

  return (
    <div style={{ maxWidth: 780, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Upload Image</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.4b_2025-08-18</div>
      </header>

      <nav style={{ marginTop: 8 }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>← Back to Profile</Link>
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
              <label style={labelStyle()}>Choose image (JPEG or PNG, max 10 MB)</label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" style={inputStyle()} />
            </div>
          </div>

          {/* Faux progress bar */}
          {uploading || progress > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 10, background: "#e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "#2563eb", transition: "width 200ms linear" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{progress}%</div>
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" disabled={!signedIn || uploading} style={buttonStyle(!signedIn || uploading)}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {uploadStatus.msg ? (
            <Status kind={uploadStatus.type}>{uploadStatus.msg}</Status>
          ) : (
            <Status kind="info">Storage path will be <code>user_id/filename</code>.</Status>
          )}
        </form>
      </section>
    </div>
  );
}

// Styles
function cardStyle() { return { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }; }
function inputStyle() { return { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }; }
function labelStyle() { return { display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }; }
function buttonStyle(disabled) { return { background: disabled ? "#9ca3af" : "#111827", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", fontSize: 14, cursor: disabled ? "not-allowed" : "pointer" }; }
