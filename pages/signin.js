// pages/signin.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

// One client, persisted session
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // If already signed in, skip this page
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) router.replace("/");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (sess) router.replace("/");
    });
    return () => sub.subscription?.unsubscribe?.();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
      <h1 style={{ margin: 0, marginBottom: 16, textAlign: "left" }}>Sign in</h1>

      <form method="post" autoComplete="on" onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="email"
            style={{ display: "block", textAlign: "left", fontWeight: 600, marginBottom: 6 }}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="password"
            style={{ display: "block", textAlign: "left", fontWeight: 600, marginBottom: 6 }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
            }}
          />
        </div>

        {err ? (
          <div role="alert" style={{ color: "#b91c1c", marginBottom: 12 }}>
            {err}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #0f766e",
            background: "#14b8a6",
            color: "white",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ marginTop: 12, textAlign: "left" }}>
          <a href="/auth/reset" style={{ textDecoration: "underline", color: "#334155" }}>
            Forgot your password?
          </a>
        </div>
      </form>
    </main>
  );
}
