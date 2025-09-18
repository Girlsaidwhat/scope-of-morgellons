import React from "react";
import { createClient } from "@supabase/supabase-js";

export default function CategoryPage({ slug, items, error }) {
  return (
    <main style={[[ maxWidth: 900, margin: "0 auto", padding: 24 ]]}>
      <h1 style={[[ margin: 0, fontSize: 28 ]]}>Category: {slug}</h1>
      {error ? (
        <p style={[[ marginTop: 12, color: #b91c1c ]]}>
          Temporarily unavailable. {typeof error === "string" ? error : ""}
        </p>
      ) : null}
      {Array.isArray(items) && items.length > 0 ? (
        <ul style={[[ marginTop: 16, lineHeight: 1.8 ]]}>
          {items.map((it) => (
            <li key={it.id}>
              <strong>{it.category || "Uncategorized"}</strong> {"}
              {it.filename || it.id}
            </li>
          ))
          </ul>
      ) : (
        <p style={[[ marginTop: 12, opacity: 0.8 ]]}>No items in this category yet.</p>
      )}
    </main>
  );
}

export async function getServerSideProps({ params }) {
  const slug = params?.slug || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { props: {slug: slug, items: [], error: "missing-env" } };
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, filename, category, bleb_color, created_at")
      .ilike("category", slug.replace(/-/g, " ") + "%")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { props: { slug, items: [], error: error.message } };
    }

    return { props: { slug, items: data || [], error: null } };
  } catch (err) {
    return { props: { slug, items: [], error: String(err?.message || err) } };
  }
}
