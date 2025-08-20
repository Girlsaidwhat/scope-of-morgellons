// Build: 36.12_2025-08-20
// Browse a11y: main landmark and labeled quick links. Counts unchanged.

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CATEGORIES = [
  { slug: "clear_to_brown_blebs", label: "Blebs (clear to brown)" },
  { slug: "biofilm", label: "Biofilm" },
  { slug: "fiber_bundles", label: "Fiber Bundles" },
  { slug: "fibers", label: "Fibers" },
  { slug: "hexagons", label: "Hexagons" },
  { slug: "crystalline_structures", label: "Crystalline Structures" },
  { slug: "feathers", label: "Feathers" },
  { slug: "miscellaneous", label: "Miscellaneous" },
  { slug: "hairs", label: "Hairs" },
  { slug: "skin", label: "Skin" },
  { slug: "wounds", label: "Wounds" },
];

const BLEBS_COLORS = ["Clear", "Yellow", "Orange", "Red", "Brown"];

function Row({ href, label, count, children }) {
  return (
    <div
      role="listitem"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "12px 14px",
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <a
        href={href}
        style={{ fontSize: 16, fontWeight: 600, color: "#0b4", textDecoration: "none" }}
        aria-label={`Open ${label} category`}
      >
        {label}
      </a>
      <div style={{ fontSize: 14, opacity: 0.8 }}>Count: <strong>{count}</strong></div>
      {children ? <div style={{ width: "100%" }}>{children}</div> : null}
    </div>
  );
}

export default function BrowsePage() {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("");

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

  // Load counts
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;

    async function loadCounts() {
      setStatus("Loading...");
      const next = {};
      for (const c of CATEGORIES) {
        const { count, error } = await supabase
          .from("image_metadata")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("category", c.label);
        next[c.label] = error ? 0 : (count || 0);
      }
      if (!canceled) {
        setCounts(next);
        setStatus("");
      }
    }

    loadCounts();
    return () => { canceled = true; };
  }, [user?.id]);

  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Browse Categories</h1>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Please sign in to view your categories.
        </div>
      ) : (
        <>
          {status && (
            <div role="status" aria-live="polite" aria-atomic="true" style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
              {status}
            </div>
          )}

          <div role="list" aria-label="Categories" style={{ display: "grid", gap: 10 }}>
            {CATEGORIES.map((c) => {
              const href = `/category/${c.slug}`;
              const count = counts[c.label] ?? 0;

              const extras =
                c.slug === "clear_to_brown_blebs" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {BLEBS_COLORS.map((clr) => (
                      <a
                        key={clr}
                        href={`${href}?color=${encodeURIComponent(clr)}`}
                        aria-label={`Filter Blebs by color ${clr}`}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          border: "1px solid #ddd",
                          borderRadius: 999,
                          textDecoration: "none",
                          color: "#333",
                          background: "#fafafa",
                        }}
                      >
                        {clr}
                      </a>
                    ))}
                  </div>
                ) : null;

              return <Row key={c.slug} href={href} label={c.label} count={count}>{extras}</Row>;
            })}
          </div>
        </>
      )}
    </main>
  );
}



