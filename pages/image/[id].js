// Build: 36.9_2025-08-19
// Image Detail: large preview + metadata, edit Notes (owner-only via RLS), and Safe Delete (Storage object then metadata row)

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, opacity: 0.8 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function ImageDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState(null);
  const [row, setRow] = useState(null);
  const [pubUrl, setPubUrl] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState("");

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

  // Load row by id (RLS ensures owner-only visibility)
  useEffect(() => {
    if (!user?.id || !id) return;
    let canceled = false;
    (async () => {
      setStatus("Loading...");
      const { data, error } = await supabase
        .from("image_metadata")
        .select(
          "id, user_id, path, filename, ext, mime_type, size, category, bleb_color, fiber_bundles_color, fibers_color, notes, created_at, uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in"
        )
        .eq("id", id)
        .maybeSingle();

      if (canceled) return;

      if (error) {
        setStatus(`Load failed: ${error.message}`);
        return;
      }
      if (!data) {
        setStatus("Not found or not accessible.");
        return;
      }

      setRow(data);
      setNotesDraft(data.notes || "");

      // Build public URL for preview
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(data.path);
      setPubUrl(urlData?.publicUrl || "");
      setStatus("");
    })();

    return () => { canceled = true; };
  }, [user?.id, id]);

  const colorBadges = useMemo(() => {
    const badges = [];
    if (row?.category === "Blebs (clear to brown)" && row?.bleb_color) badges.push(["Bleb color", row.bleb_color]);
    if (row?.category === "Fiber Bundles" && row?.fiber_bundles_color) badges.push(["Fiber bundles color", row.fiber_bundles_color]);
    if (row?.category === "Fibers" && row?.fibers_color) badges.push(["Fibers color", row.fibers_color]);
    return badges;
  }, [row]);

  async function saveNotes() {
    if (!row?.id) return;
    setSaving(true);
    setStatus("Saving...");
    const newNotes = notesDraft.trim() ? notesDraft.trim() : null;

    const { error } = await supabase
      .from("image_metadata")
      .update({ notes: newNotes })
      .eq("id", row.id);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setRow((r) => ({ ...r, notes: newNotes }));
    setStatus("Saved.");
    setSaving(false);
  }

  async function handleDelete() {
    if (!row?.id || !user?.id) return;

    // Clear confirmation
    const first = confirm(
      `This will permanently delete the image file and its metadata.\n\nFile: ${row.filename}\n\nContinue?`
    );
    if (!first) return;

    const typed = prompt(`Type DELETE to confirm deleting "${row.filename}".`);
    if ((typed || "").trim().toUpperCase() !== "DELETE") {
      setStatus("Delete canceled.");
      return;
    }

    setDeleting(true);
    setStatus("Deleting...");

    // 1) Delete Storage object first (avoid leaving a public file)
    const { error: storErr } = await supabase.storage.from("images").remove([row.path]);
    if (storErr) {
      setStatus(`Storage delete failed: ${storErr.message}`);
      setDeleting(false);
      return;
    }

    // 2) Delete metadata row (RLS enforces ownership)
    const { error: metaErr } = await supabase.from("image_metadata").delete().eq("id", row.id);
    if (metaErr) {
      setStatus(
        `Row delete failed: ${metaErr.message}. The file has been removed from Storage; you can retry deleting the row.`
      );
      setDeleting(false);
      return;
    }

    // Done → take them home
    setStatus("Deleted.");
    router.replace("/");
  }

  const isOwner = user?.id && row?.user_id && user.id === row.user_id;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Image Detail</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Build: 36.9_2025-08-19</div>
      </header>

      {!user ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>Please sign in to view this page.</div>
      ) : status && !row ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>{status}</div>
      ) : row ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
          {/* Left: big preview */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
            {pubUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pubUrl}
                alt={row.filename}
                style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
              />
            ) : (
              <div style={{ padding: 12, fontSize: 14 }}>Preview unavailable.</div>
            )}
          </div>

          {/* Right: metadata + notes editor + delete */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
            <Field label="Filename">{row.filename}</Field>
            <Field label="Category">
              <span style={{ padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999, fontSize: 12 }}>
                {row.category}
              </span>
            </Field>

            {colorBadges.length > 0 && (
              <Field label="Color">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {colorBadges.map(([k, v]) => (
                    <span key={k} style={{ padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999, fontSize: 12 }}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Type / Size">
              <span>{row.mime_type || "n/a"}</span>
              <span style={{ margin: "0 6px" }}>•</span>
              <span>{typeof row.size === "number" ? `${(row.size / (1024 * 1024)).toFixed(2)} MB` : "n/a"}</span>
            </Field>

            <Field label="Path">{row.path}</Field>

            <Field label="Uploader snapshot">
              <div style={{ fontSize: 14 }}>
                {row.uploader_initials ? `Initials: ${row.uploader_initials}` : "Initials: n/a"}
                <br />
                {row.uploader_age != null ? `Age: ${row.uploader_age}` : "Age: n/a"}
                <br />
                {row.uploader_location ? `Location: ${row.uploader_location}` : "Location: n/a"}
                <br />
                {row.uploader_contact_opt_in != null
                  ? `Contact opt-in: ${row.uploader_contact_opt_in ? "Yes" : "No"}`
                  : "Contact opt-in: n/a"}
              </div>
            </Field>

            <hr style={{ margin: "16px 0" }} />

            <Field label="Notes (edit)">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={6}
                placeholder="Add context about this image…"
                style={{ width: "100%", padding: 8, resize: "vertical" }}
                disabled={!isOwner || saving || deleting}
              />
            </Field>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={saveNotes}
                disabled={!isOwner || saving || deleting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #0f766e",
                  background: saving ? "#8dd3cd" : "#14b8a6",
                  color: "white",
                  cursor: !isOwner || saving || deleting ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
                type="button"
              >
                {saving ? "Saving..." : "Save Notes"}
              </button>
              <button
                onClick={() => {
                  setNotesDraft(row.notes || "");
                  setStatus("Changes discarded.");
                }}
                disabled={!isOwner || saving || deleting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  background: "white",
                  cursor: !isOwner || saving || deleting ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
                type="button"
              >
                Cancel
              </button>
            </div>

            {isOwner && (
              <div style={{ borderTop: "1px solid #f1f1f1", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>
                  Danger zone
                </div>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  type="button"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #dc2626",
                    background: deleting ? "#fca5a5" : "#ef4444",
                    color: "white",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete Image"}
                </button>
              </div>
            )}

            {status && (
              <div style={{ marginTop: 12, fontSize: 13, color: /failed|error/i.test(status) ? "#b91c1c" : "#065f46" }}>
                {status}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


