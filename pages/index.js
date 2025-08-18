// pages/index.js
// The Scope of Morgellons — Home
// Build: 36.4a_2025-08-18

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Category values stored in DB (value), with capitalized UI labels.
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

// Bleb color options shown only for the Clear--Brown "Blebs" category.
const BLEB_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];

// Simple utility for status text colors
const Status = ({ kind = "info", children }) => {
  const color =
    kind === "error" ? "#b91c1c" : kind === "success" ? "#065f46" : "#374151";
  const bg =
    kind === "error" ? "#fee2e2" : kind === "success" ? "#d1fae5" : "#e5e7eb";
  return (
    <div
      style={{
        background: bg,
        color,
        padding: "8px 10px",
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 1.3,
        marginTop: 8,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </div>
  );
};

export default function HomePage() {
  const [user, setUser] = useState(null);

  // Profile
  const [initials, setInitials] = useState("");
  const [age, setAge] = useState("");
  const [locationText, setLocationText] = useState("");
  const [contactOptIn, setContactOptIn] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ type: "info", msg: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Upload
  const fileInputRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState("miscellaneous");
  const [blebColor, setBlebColor] = useState(""); // empty = not set
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: "info", msg: "" });

  // Gallery
  const [items, setItems] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Allowed client checks
  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png"];

  const publicUrlFor = (path) => {
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data?.publicUrl || "";
  };

  // Load auth user and profile + gallery
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data: auth } = await supabase.auth.getUser();
      const currentUser = auth?.user || null;
      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await Promise.all([loadProfile(currentUser.id), loadGallery(currentUser.id)]);
      }
    }

    bootstrap();

    // Keep session in sync on auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        loadProfile(currentUser.id);
        loadGallery(currentUser.id);
      } else {
        setItems([]);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from("user_profile")
      .select("initials, age, location, contact_opt_in")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return;
    }
    if (data) {
      setInitials(data.initials ?? "");
      setAge(data.age ?? "");
      setLocationText(data.location ?? "");
      setContactOptIn(Boolean(data.contact_opt_in));
    }
  }

  async function loadGallery(userId) {
    setLoadingGallery(true);
    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, user_id, path, filename, category, bleb_color, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setLoadingGallery(false);

    if (error) {
      return;
    }
    setItems(Array.isArray(data) ? data : []);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!user) return;
    setProfileStatus({ type: "info", msg: "" });
    setIsSavingProfile(true);

    const payload = {
      user_id: user.id,
      initials: initials?.trim() || null,
      age: age === "" ? null : Number(age),
      location: locationText?.trim() || null,
      contact_opt_in: !!contactOptIn,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("user_profile").upsert(payload, {
      onConflict: "user_id",
    });

    setIsSavingProfile(false);

    if (error) {
      setProfileStatus({
        type: "error",
        msg: "Profile save failed. Please try again.",
      });
      return;
    }
    setProfileStatus({
      type: "success",
      msg: "Profile saved.",
    });
  }

  // Faux progress bar while upload runs
  useEffect(() => {
    if (!uploading) return;
    setProgress(0);
    let pct = 0;
    const tick = () => {
      pct = Math.min(pct + Math.random() * 10 + 5, 90);
      setProgress(Math.floor(pct));
    };
    const id = setInterval(tick, 350);
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

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setUploading(false);
      setProgress(0);
      setUploadStatus({
        type: "error",
        msg: "Upload failed. Please try another image or filename.",
      });
      return;
    }

    // Snapshot profile at time of upload
    const profileSnapshot = {
      uploader_initials: initials?.trim() || null,
      uploader_age: age === "" ? null : Number(age),
      uploader_location: locationText?.trim() || null,
      uploader_contact_opt_in: !!contactOptIn,
    };

    // Only store bleb_color when category is Clear--Brown "Blebs"
    const blebColorValue =
      selectedCategory === "clear_to_brown_blebs" ? (blebColor || null) : null;

    // Insert metadata row including category, bleb_color, and uploader_* snapshot
    const { error: metaError } = await supabase.from("image_metadata").insert([
      {
        user_id: user.id,
        bucket: "images",
        path,
        filename: file.name,
        category: selectedCategory,
        bleb_color: blebColorValue,
        ...profileSnapshot,
      },
    ]);

    setUploading(false);
    setProgress(100);

    if (metaError) {
      const details =
        [
          metaError.message,
          metaError.details,
          metaError.hint,
          metaError.code ? `code: ${metaError.code}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      console.error("Metadata insert failed:", metaError);
      setUploadStatus({
        type: "error",
        msg: "Upload stored, but metadata insert failed.\n" + details,
      });
      return;
    }

    // Clear inputs and refresh gallery
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBlebColor("");
    setUploadStatus({
      type: "success",
      msg: "Upload successful. Metadata saved. Gallery updated.",
    });
    await loadGallery(user.id);
  }

  const signedIn = useMemo(() => Boolean(user?.id), [user]);
  const isBlebCategory = selectedCategory === "clear_to_brown_blebs";

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "32px auto",
        padding: "0 16px 64px",
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>The Scope of Morgellons</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.4a_2025-08-18</div>
      </header>

      {!signedIn ? (
        <Status kind="info">
          You must be signed in to use uploads and see your gallery. Use your normal sign in flow.
        </Status>
      ) : null}

      {/* Category links section (simple) */}
      <section style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Browse by Category</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.filter(c => c.value !== "miscellaneous").map((c) => (
            <Link
              key={c.value}
              href={`/category/${c.value}`}
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 13,
                color: "#111827",
                textDecoration: "none",
              }}
              title={`View ${c.label}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Links will work after we add the category pages next.
        </p>
      </section>

      {/* Profile */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Profile</h2>
        <p style={{ marginTop: 0, color: "#4b5563", fontSize: 14 }}>
          These fields are saved and a snapshot is stored with each upload.
        </p>
        <form onSubmit={saveProfile} style={cardStyle()}>
          <div style={grid2()}>
            <div>
              <label style={labelStyle()}>Initials</label>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="EC"
                style={inputStyle()}
                maxLength={8}
              />
            </div>
            <div>
              <label style={labelStyle()}>Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="42"
                style={inputStyle()}
                min={0}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle()}>Location</label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Pennsylvania, USA"
              style={inputStyle()}
              maxLength={120}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="optin"
              type="checkbox"
              checked={contactOptIn}
              onChange={(e) => setContactOptIn(e.target.checked)}
            />
            <label htmlFor="optin" style={{ fontSize: 14 }}>
              Open to being contacted by researchers or other members
            </label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={!signedIn || isSavingProfile}
              style={buttonStyle(!signedIn || isSavingProfile)}
            >
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
          {profileStatus.msg ? (
            <Status kind={profileStatus.type}>{profileStatus.msg}</Status>
          ) : null}
        </form>
      </section>

      {/* Upload */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Upload Image</h2>
        <form onSubmit={handleUpload} style={cardStyle()}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle()}>Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={inputStyle()}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {isBlebCategory ? (
              <div>
                <label style={labelStyle()}>Bleb Color</label>
                <select
                  value={blebColor}
                  onChange={(e) => setBlebColor(e.target.value)}
                  style={inputStyle()}
                >
                  <option value="">(Optional) Select a color</option>
                  {BLEB_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label style={labelStyle()}>
                Choose image (JPEG or PNG, max 10 MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={inputStyle()}
              />
            </div>
          </div>

          {/* Faux progress bar */}
          {uploading || progress > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 10,
                  background: "#e5e7eb",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "#2563eb",
                    transition: "width 200ms linear",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                {progress}%
              </div>
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
            <Status kind="info">
              Storage path will be <code>user_id/filename</code>. Gallery refreshes on success.
            </Status>
          )}
        </form>
      </section>

      {/* Gallery */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Your Gallery</h2>
        {loadingGallery ? (
          <p style={{ color: "#6b7280" }}>Loading...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No images yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {items.map((it) => (
              <article
                key={it.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={publicUrlFor(it.path)}
                    alt={it.filename || "uploaded image"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ padding: 12 }}>
                  {/* Category and optional color badges */}
                  <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 12,
                        padding: "4px 8px",
                        background: "#eef2ff",
                        color: "#3730a3",
                        borderRadius: 999,
                      }}
                      title={it.category || "Uncategorized"}
                    >
                      {badgeLabel(it.category)}
                    </span>
                    {it.category === "clear_to_brown_blebs" && it.bleb_color ? (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 12,
                          padding: "4px 8px",
                          background: "#ecfeff",
                          color: "#155e75",
                          borderRadius: 999,
                        }}
                        title={`Bleb Color: ${it.bleb_color}`}
                      >
                        {it.bleb_color}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#111827",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={it.filename}
                  >
                    {it.filename}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    {new Date(it.created_at).toLocaleString()}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function badgeLabel(v) {
  const found = CATEGORIES.find((c) => c.value === v);
  return found ? cLabel(found.label) : "Uncategorized";
}

// In case labels ever change casing upstream, normalize here
function cLabel(label) {
  return label;
}

// Styles
function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };
}
function inputStyle() {
  return {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  };
}
function labelStyle() {
  return { display: "block", fontSize: 13, color: "#374151", marginBottom: 6 };
}
function buttonStyle(disabled) {
  return {
    background: disabled ? "#9ca3af" : "#111827",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
function grid2() {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };
}
