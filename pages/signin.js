// pages/signin.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export default function SignIn() {
  const router = useRouter();

  // Create supabase client only in the browser
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    return createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
  }, []);

  // Refs = better for password managers than controlled inputs
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // If already signed in, bounce to home
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session?.user) router.replace("/");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) router.replace("/");
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase, router]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!supabase) {
      setMsg("Auth is not ready. Missing environment variables.");
      return;
    }
    const email = emailRef.current?.value?.trim() || "";
    const password = passwordRef.current?.value || "";
    if (!email || !password) {
      setMsg("Please enter your email and password.");
      return;
    }
    try {
      setBusy(true);
      setMsg("");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message || "Sign-in failed.");
        setBusy(false);
        return;
      }
      // Success: redirect happens via onAuthStateChange, but do it eagerly too
      router.replace("/");
    } catch (err) {
      setMsg(err?.message || "Unexpected error.");
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: 24,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: 24, textAlign: "left" }}>Sign in</h1>

      <form onSubmit={onSubmit} autoComplete="on" style={{ textAlign: "left" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label htmlFor="email" style={{ fontSize: 12, opacity: 0.9 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            ref={emailRef}
            required
            style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
          />

          <label htmlFor="current-password" style={{ fontSize: 12, opacity: 0.9 }}>
            Password
          </label>
          <input
            id="current-password"
            name="password"
            type="password"
            autoComplete="current-password"
            ref={passwordRef}
            required
            style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 }}
          />

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy ? "true" : "false"}
            style={{
              marginTop: 6,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: busy ? "#8dd3cd" : "#14b8a6",
              color: "white",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {msg ? (
            <div role="status" aria-live="polite" style={{ fontSize: 12, color: "#b91c1c" }}>
              {msg}
            </div>
          ) : null}

          <a
            href="/auth/reset"
            style={{ fontSize: 12, color: "#334155", textDecoration: "underline", marginTop: 4, width: "fit-content" }}
          >
            Forgot password?
          </a>
        </div>
      </form>
    </main>
  );
}
