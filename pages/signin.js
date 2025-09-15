// pages/signin.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "scope-of-morgellons-auth"
    }
  }
);

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // If already signed in, bounce to home
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session?.user) {
        router.replace("/");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) router.replace("/");
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message || "Sign in failed");
        return;
      }
      // Success path handled by onAuthStateChange → redirect
    } catch (ex) {
      setErr(ex?.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  const box = useMemo(
    () => ({
      label: { display: "block", fontSize: 12, marginBottom: 6, opacity: 0.85, textAlign: "left" },
      input: {
        width: "100%",
        padding: "10px 12px",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        textAlign: "left", // force left alignment even if globals try to center
        background: "#fff"
      },
      btn: {
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid #0f766e",
        background: busy ? "#8dd3cd" : "#14b8a6",
        color: "#fff",
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        width: "100%"
      }
    }),
    [busy]
  );

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 20 }}>
      <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: 26 }}>Sign in</h1>
      <p style={{ marginTop: 0, marginBottom: 16, color: "#475569", fontSize: 14 }}>
        Use the email and password you created. (Password managers should autofill automatically.)
      </p>

      {err ? (
        <div role="alert" style={{ border: "1px solid #fca5a5", background: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          {err}
        </div>
      ) : null}

      <form onSubmit={onSubmit} autoComplete="on" spellCheck={false}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email" style={box.label}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={box.input}
            required
          />
        </div>

        <div style={{ marginBottom: 6 }}>
          <label htmlFor="current-password" style={box.label}>
            Password
          </label>
          <input
            id="current-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={box.input}
            required
          />
        </div>

        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <Link href="/auth/reset" style={{ fontSize: 12, color: "#0ea5e9", textDecoration: "underline" }}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={busy} aria-busy={busy ? "true" : "false"} style={box.btn}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
