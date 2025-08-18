// pages/index.js
// The Scope of Morgellons — Home (Profile + Gallery with category badges)
// Build: 36.5_2025-08-18

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Category labels (keep in sync with /upload and /browse)
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
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

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

export default function HomePage() {
  const [user, setUser] = useState(null);

  // Profile state
  const [profile, setProfile] = useState({
    initials: "",
    age: "",
    location: "",
    contact_opt_in: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ type: "info", msg: "" });

  // Gallery state
  const [items, setItems] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const signedIn = useMemo(() => Boolean(user?.id), [user]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      const currentUser = auth?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // Load profile
        const { data: prof } = await supabase
          .from("user_profile")
          .select("initials, age, location, contact_opt_in")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (prof) {
          setProfile({
            initials: prof.initials ?? "",
            age: prof.age ?? "",
            location: prof.location ?? "",
            contact_opt_in: !!prof.contact_opt_in,
          });
        }

        // Load gallery (newest first)
        await loadGallery(currentUser.id);
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  async function loadGallery(userId) {
    setLoadingGallery(true);
    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, user_id, path, filename, category, bleb_color, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(48);
    setLoadingGallery(false);
    if (error || !Array.isArray(data)) {
      setItems([]);
      return;
    }
    setItems(data);
  }

  function publicUrlFor(path) {
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileStatus({ type: "info", msg: "" });

    const payload = {
      user_id: user.id,
      initials: (profile.initials || "").trim() || null,
      age: profile.age === "" ? null : Number(profile.age),
      location: (profile.location || "").trim() || null,
      contact_opt_in: !!profile.contact_opt_in,
    };

    const { error } = await supabase
      .from("user_profile")
      .upsert(payload, { onConflict: "user_id" });

    setSavingProfile(false);

    if (error) {
      const details = [error.message, error.details, error.hint, error.code ? `code: ${error.code}` : null]
        .filter(Boolean).join("\n");
      setProfileStatus({ type: "error", msg: "Profile save failed.\n" + details });
      return;
    }

    setProfileStatus({ type: "success", msg: "Profile saved." });
  }

  return (
    <div style={{ maxWidth: 980, margin: "32px auto", padding: "0 16px 64px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>The Scope of Morgellons</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Build 36.5_2025-08-18</div>
      </header>

      {/* Shortcuts */}
      <nav style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/upload" style={pillLinkStyle()} title="Go to Uploader">Go to Uploader</Link>
        <Link href="/browse" style={pillLinkStyle()} title="Browse by Category">Browse by Category</Link>
      </nav>

      {/* Profile */}
      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px 0" }}>Profile</h2>
        {!signedIn ? (
          <Status kind="info">Sign in to save your profile and view your gallery.</Status>
        ) : (
          <form onSubmit={handleSaveProfile} style={cardStyle()}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / 2" }}>
                <label style={labelStyle()}>Initials</label>
                <input
                  type="text"
                  value={profile.initials}
                  onChange={(e) => setProfile({ ...profile, initials: e.target.value })}
                  style={inputStyle()}
                  maxLength={8}
                />
              </div>
              <div>
                <label style={labelStyle()}>Age</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="120"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  style={inputStyle()}
                />
              </div>
              <div style={{ gridColumn: "1 / 3" }}>
                <label style={labelStyle()}>Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  style={inputStyle()}
                  placeholder="City, State"
                  maxLength={120}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="contactOptIn"
                  type="checkbox"
                  checked={profile.contact_opt_in}
                  onChange={(e) => setProfile({ ...profile, contact_opt_in: e.target.checked })}
                />
                <label htmlFor="contactOptIn" style={{ fontSize: 14, color: "#111827" }}>
                  Open to contact by researchers
                </label>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="submit" disabled={savingProfile} style={buttonStyle(savingProfile)}>
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </div>

            {profileStatus.msg ? (
              <Status kind={profileStatus.type}>{profileStatus.msg}</Status>
            ) : (
              <Status kind="info">These details are snapshotted into each new upload.</Status>
            )}
          </form>
        )}
      </section>

      {/* Gallery */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px 0" }}>Your Gallery</h2>
        {!signedIn ? (
          <Status kind="info">Sign in to view your uploads.</Status>
        ) : loadingGallery ? (
          <p style={{ color: "#6b7280" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No images yet. Try the Uploader.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {items.map((it) => {
              const label = CAT_LABEL[it.category] || "Uncategorized";
              const isBlebs = it.category === "clear_to_brown_blebs";
              const badgeHref = isBlebs && it.bleb_color
                ? `/category/clear_to_brown_blebs?color=${encodeURIComponent(it.bleb_color)}`
                : `/category/${it.category || "miscellaneous"}`;

              return (
                <article key={it.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img
                      src={publicUrlFor(it.path)}
                      alt={it.filename || "uploaded image"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  </div>

                  <div style={{ padding: 12 }}>
                    {/* Category badge (and optional color) */}
                    <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link
                        href={badgeHref}
                        title={label}
                        style={{ display: "inline-block", fontSize: 12, padding: "4px 8px", background: "#eef2ff", color: "#3730a3", borderRadius: 999, textDecoration: "none", border: "1px solid #e5e7eb" }}
                      >
                        {label}
                      </Link>
                      {isBlebs && it.bleb_color ? (
                        <Link
                          href={`/category/clear_to_brown_blebs?color=${encodeURIComponent(it.bleb_color)}`}
                          title={`Bleb Color: ${it.bleb_color}`}
                          style={{ display: "inline-block", fontSize: 12, padding: "4px 8px", background: "#ecfeff", color: "#155e75", borderRadius: 999, textDecoration: "none", border: "1px solid #e5e7eb" }}
                        >
                          {it.bleb_color}
                        </Link>
                      ) : null}
                    </div>

                    {/* Filename and timestamp */}
                    <div style={{ fontSize: 14, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.filename}>
                      {it.filename}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {new Date(it.created_at).toLocaleString()}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// Styles
function cardStyle() { return { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }; }
function inputStyle() { return { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }; }
function labelStyle() { return { display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }; }
function buttonStyle(disabled) { return { background: disabled ? "#9ca3af" : "#111827", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", fontSize: 14, cursor: disabled ? "not-allowed" : "pointer" }; }
function pillLinkStyle() { return { display: "inline-block", padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, color: "#111827", textDecoration: "none" }; }

