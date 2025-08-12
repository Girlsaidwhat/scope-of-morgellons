// pages/index.js
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [session, setSession] = useState(null);

  // Auth form state
  const [mode, setMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // Upload state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState([]); // {name, url}[]

  // Watch auth session
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Load user images when signed in
  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setMessage("");
      const prefix = `${session.user.id}/`;
      const { data, error } = await supabase.storage
        .from("images")
        .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (error) {
        setMessage(error.message);
        return;
      }

      const rows =
        (data || []).map((obj) => {
          const { data: pub } = supabase.storage.from("images").getPublicUrl(prefix + obj.name);
          return { name: obj.name, url: pub.publicUrl };
        }) || [];
      setItems(rows);
    };
    load();
  }, [session]);

  // Sign in / Sign up
  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");
    if (mode === "sign_in") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else setMessage(`Signed in as ${data.user?.email || "user"}.`);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage("Check your email for a confirmation link.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setItems([]);
    setMessage("Signed out.");
  };

  // Upload
  const upload = async () => {
    if (!file || !session) return;
    setUploading(true);
    setMessage("");
    try {
      const prefix = `${session.user.id}/`;
      const path = `${prefix}${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("images").upload(path, file, { upsert: false });
      if (error) throw error;

      const { data: pub } = supabase.storage.from("images").getPublicUrl(path);
      setItems((prev) => [{ name: file.name, url: pub.publicUrl }, ...prev]);
      setFile(null);
      setMessage("Uploaded.");
    } catch (err) {
      setMessage(err?.message || "Upload error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      {!session ? (
        <>
          <h1 style={{ marginBottom: 12 }}>Welcome</h1>

          {/* Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setMode("sign_in")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: mode === "sign_in" ? "#eee" : "#fff",
                cursor: "pointer",
                flex: 1,
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("sign_up")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: mode === "sign_up" ? "#eee" : "#fff",
                cursor: "pointer",
                flex: 1,
              }}
            >
              Sign up
            </button>
          </div>

          {/* Auth form */}
          <form onSubmit={handleAuth} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </label>
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                width: 120,
              }}
            >
              {mode === "sign_in" ? "Sign in" : "Sign up"}
            </button>
          </form>

          {message ? (
            <div style={{ marginTop: 12, padding: 10, background: "#f6f6f6", borderRadius: 8 }}>
              {message}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2>Welcome, {session.user?.email}</h2>
            <button
              onClick={signOut}
              type="button"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
            >
              Sign out
            </button>
          </div>

          <div style={{ marginTop: 16, padding: 16, border: "1px solid #e5e5e5", borderRadius: 10 }}>
            <h3 style={{ marginTop: 0 }}>Upload an image</h3>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div style={{ marginTop: 10 }}>
              <button
                onClick={upload}
                disabled={!file || uploading}
                type="button"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: uploading ? "#999" : "#111",
                  color: "#fff",
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            {message ? (
              <div style={{ marginTop: 12, padding: 10, background: "#f6f6f6", borderRadius: 8 }}>
                {message}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Your images</h3>
            {items.length === 0 ? (
              <p>No images yet.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                {items.map((it) => (
                  <div key={it.url} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 8 }}>
                    <img src={it.url} alt={it.name} style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }} />
                    <div style={{ fontSize: 12, marginTop: 6, wordBreak: "break-word" }}>{it.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

