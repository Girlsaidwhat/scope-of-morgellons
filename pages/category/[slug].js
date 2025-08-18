// pages/category/[slug].js
// The Scope of Morgellons — Category Listing (per-user, supports ?color= for Blebs)
// Build: 36.4h2_2025-08-18

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Known categories with display labels
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
    <div style={{ background: bg, color, padding: "8px 10px", borderRadius: 8, fontSize: 14, marginTop: 8 }}>
      {children}
    </div>
  );
};

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blebColor, setBlebColor] = useState(""); // optional filter for blebs

  const cat = useMemo(() => CATEGORIES.find((c) => c.value === slug), [slug]);
  const isBlebCategory = slug === "clear_to_brown_blebs";

  const publicUrlFor = (path) => {
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data?.publicUrl || "";
  };

  // Initialize: get user, read ?color (for Blebs), then load
  useEffect(() => {
    if (!router.isReady) return;

    let mounted = true;
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;

      const currentUser = auth?.user || null;
      setUser(currentUser);

      const qColor = typeof router.query.color === "string" ? router.query.color : "";
      if (currentUser && slug && cat) {
        if (isBlebCategory && BLEB_COLORS.includes(qColor)) {
          setBlebColor(qColor);
          await loadCategory(currentUser.id, slug, qColor);
        } else {
          await loadCategory(currentUser.id, slug, "");
        }
      }
    }
    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, slug]);

  // Reload when blebColor changes (only applies to blebs)
  useEffect(() => {
    if (user?.id && slug && cat) {
      loadCategory(user.id, slug, blebColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blebColor]);

  async function loadCategory(userId, slugValue, colorFilter) {
    setLoading(true);
    let query = supabase
      .from("image_metadata")
      .select("id, user_id, path, filename, category, bleb_color, created_at")
      .eq("user_id", userId)
      .eq("category", slugValue)
      .order("created_at", { ascending: false });

    if (slugValue === "clear_to_brown_blebs" && colorFilter) {
      query = query.eq("bleb_color", colorFilter);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      setItems([]);
      return;
    }
    setItems(Array.isArray(data) ? data : []);
  }

  if (!slug) return null;

  if (!cat) {
    return (
      <Wrapper>
        <Header title="Unknown Category" build="36.4h2_2025-08-18" />
        <nav style={{ marginTop: 8 }}>
          <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            ← Back to Profile
          </Link>
        </nav>
        <Status kind="error">This category is not recognized.</Status>
      </Wrapper>
    );
  }

  const title = `Category: ${cat.label}`;

  return (
    <Wrapper>
      <Header title={title} build="36.4h2_2025-08-18" />

      <nav style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          ← Back to Profile
        </Link>
        <Link href="/browse" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          Browse Categories
        </Link>
        <Link href="/upload" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          Upload
        </Link>
      </nav>

      {/* Optional filter for Blebs */}
      {isBlebCategory ? (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }}>
            Filter by Bleb Color (optional)
          </label>
          <select
            value={blebColor}
            onChange={(e) => setBlebColor(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 320,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              outline: "none",
            }}
          >
            <option value="">All colors</option>
            {BLEB_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <section style={{ marginTop: 16 }}>
        {!user ? (
          <Status kind="info">Sign in to view your images for this category.</Status>
        ) : loading ? (
          <p style={{ color: "#6b7280" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No images in this category yet.</p>
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
                      {cat.label}
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
    </Wrapper>
  );
}

function Wrapper({ children }) {
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
      {children}
    </div>
  );
}

function Header({ title, build }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <h1 style={{ fontSize: 24, margin: 0 }}>{title}</h1>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{build}</div>
    </header>
  );
}
