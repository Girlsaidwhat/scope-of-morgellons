// Build: 36.10b_2025-08-20
// Home: Profile form + gallery with "Load more" pagination and CSV export.
// Keeps: sign-in flow, category/color badges, newest-first ordering, header count.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE = 24;

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

export default function HomePage() {
  // Auth/user
  const [user, setUser] = useState(null);

  // Profile form
  const [initials, setInitials] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [contactOptIn, setContactOptIn] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");

  // Gallery
  const [count, setCount] = useState(null); // null = unknown
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState("");

  // Load user
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data?.user ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // Load profile for signed-in user
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("initials, age, location, contact_opt_in")
        .eq("user_id", user.id)
        .single();
      if (canceled) return;
      if (error && error.code !== "PGRST116") {
        // Ignore "No rows found" (PGRST116); surface others lightly
        setProfileStatus(`Profile load error: ${error.message}`);
        return;
      }
      if (data) {
        setInitials(data.initials || "");
        setAge(data.age ?? "");
        setLocation(data.location || "");
        setContactOptIn(!!data.contact_opt_in);
      }
    })();
    return () => { canceled = true; };
  }, [user?.id]);

  // Save profile
  async function saveProfile(e) {
    e.preventDefault();
    if (!user?.id) return;
    setProfileStatus("Saving...");
    const payload = {
      user_id: user.id,
      initials: initials || null,
      age: age === "" ? null : Number(age),
      location: location || null,
      contact_opt_in: contactOptIn,
    };
    const { error } = await supabase.from("user_profile").upsert(payload, { onConflict: "user_id" });
    if (error) {
      setProfileStatus(`Save error: ${error.message}`);
      return;
    }
    setProfileStatus("Profile saved.");
    setTimeout(() => setProfileStatus(""), 1500);
  }

  // Reset gallery when user changes (or after sign-in)
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(null);
    setGalleryStatus("");
  }, [user?.id]);

  // Fetch total count (header)
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { count: total, error } = await supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (canceled) return;
      if (error) {
        setCount(null); // unknown; do not block UI
        return;
      }
      setCount(typeof total === "number" ? total : null);
    })();
    return () => { canceled = true; };
  }, [user?.id]);

  // Load a page of gallery items (append)
  async function loadMore() {
    if (!user?.id) return;
    setLoading(true);
    setGalleryStatus(items.length === 0 ? "Loading..." : "");

    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, path, filename, category, bleb_color, fiber_bundles_color, fibers_color, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setGalleryStatus(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    const batch = data || [];
    setItems((prev) => [...prev, ...batch]);
    setOffset((prev) => prev + batch.length);
    setGalleryStatus("");
    setLoading(false);
  }

  // Initial gallery load
  useEffect(() => {
    if (user?.id && offset === 0 && items.length === 0) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Determine if more pages likely exist
  const hasMore = useMemo(() => {
    if (loading) return false;
    if (items.length === 0) return false;
    if (typeof count === "number") return items.length < count;
    return items.length % PAGE_SIZE === 0; // unknown count: offer more if the last page was full
  }, [items.length, count, loading]);

  // CSV export (all rows for signed-in user)
  async function exportCSV() {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("image_metadata")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(`CSV error: ${error.message}`);
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      alert("No rows to export.");
      return;
    }

    // Build CSV
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            if (v === null || v === undefined) return "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image_metadata.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function cardColorBadge(row) {
    if (row.category === "Blebs (clear to brown)" && row.bleb_color) return <Badge>Color: {row.bleb_color}</Badge>;
    if (row.category === "Fiber Bundles" && row.fiber_bundles_color) return <Badge>Color: {row.fiber_bundles_color}</Badge>;
    if (row.category === "Fibers" && row.fibers_color) return <Badge>Color: {row.fibers_color}</Badge>;
    return null;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Home</h1>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          Total items: <strong>{typeof count === "number" ? count : "…"}</strong>
        </div>
      </header>

      {/* Profile form */}
      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Please sign in to view your profile and gallery.
        </div>
      ) : (
        <>
          <form
            onSubmit={saveProfile}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              padding: 12,
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              background: "#fff",
              marginBottom: 16,
            }}
          >
            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Initials</label>
              <input
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="optin"
                type="checkbox"
                checked={contactOptIn}
                onChange={(e) => setContactOptIn(e.target.checked)}
              />
              <label htmlFor="optin" style={{ fontSize: 12 }}>Contact opt-in</label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="submit"
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #0f766e",
                  background: "#14b8a6",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Profile
              </button>
              {profileStatus ? <span style={{ fontSize: 12, opacity: 0.8 }}>{profileStatus}</span> : null}
            </div>
          </form>

          {/* Actions row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <a href="/upload" style={{ textDecoration: "none", color: "#0b4", fontWeight: 600 }}>
              Go to Uploads
            </a>
            <button
              onClick={exportCSV}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: "#1f2937",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Export CSV
            </button>
          </div>

          {/* Gallery status */}
          {galleryStatus && items.length === 0 ? (
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
              {galleryStatus}
            </div>
          ) : null}

          {/* Gallery grid */}
          {items.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {items.map((row) => {
                const { data: pub } = supabase.storage.from("images").getPublicUrl(row.path);
                const url = pub?.publicUrl || "";
                return (
                  <a
                    key={row.id}
                    href={`/image/${row.id}`}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e5e5",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={row.filename}
                      style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                    />
                    <div style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        <Badge>{row.category}</Badge>
                        {row.category === "Blebs (clear to brown)" && row.bleb_color ? (
                          <Badge>Color: {row.bleb_color}</Badge>
                        ) : null}
                        {row.category === "Fiber Bundles" && row.fiber_bundles_color ? (
                          <Badge>Color: {row.fiber_bundles_color}</Badge>
                        ) : null}
                        {row.category === "Fibers" && row.fibers_color ? (
                          <Badge>Color: {row.fibers_color}</Badge>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{prettyDate(row.created_at)}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}

          {/* Load more / end-of-list / empty */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            {items.length === 0 && !galleryStatus ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No items yet.</div>
            ) : hasMore ? (
              <button
                onClick={loadMore}
                disabled={loading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #0f766e",
                  background: loading ? "#8dd3cd" : "#14b8a6",
                  color: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            ) : items.length > 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No more items.</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
