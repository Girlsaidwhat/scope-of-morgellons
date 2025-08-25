// pages/_app.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createClient } from "@supabase/supabase-js";
import "../styles/globals.css";

// Single source of truth for Build tag (visible bottom-right)
const BUILD_TAG = "36.91_2025-08-25";

// Create Supabase client (v2)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // Auth state
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Sign-in form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState(""); // success/info
  const [authErr, setAuthErr] = useState(""); // errors

  // Password tips toggle (for the existing "?" helper)
  const [showPwTips, setShowPwTips] = useState(false);

  // Keep a ref so we can focus the first field on mount
  const emailRef = useRef(null);

  // 1) Initial session check + 2) keep in sync on changes
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session ?? null);
      setCheckingSession(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);

      // If the user just signed in and is on /auth/reset, go Home so they see Welcome + gallery
      if (nextSession && router.pathname.startsWith("/auth/reset")) {
        router.replace("/");
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  // Focus the email field the first time the overlay appears
  useEffect(() => {
    if (!checkingSession && !session && !router.pathname.startsWith("/auth/reset")) {
      emailRef.current?.focus();
    }
  }, [checkingSession, session, router.pathname]);

  // Submit handler: v2 signInWithPassword
  const onSubmitSignIn = async (e) => {
    e.preventDefault();
    setAuthErr("");
    setAuthMsg("");
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      setAuthMsg("Signed in.");
      // Ensure Home shows after sign-in so Welcome + gallery are visible
      if (router.pathname !== "/") {
        await router.replace("/");
      }
    } catch (err) {
      setAuthErr(err?.message || "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  // Show the sign-in overlay on every page except the reset route
  const shouldShowSignIn =
    !checkingSession && !session && !router.pathname.startsWith("/auth/reset");

  // Keep layout stable: render page content always; overlay sits above when needed
  return (
    <>
      <Head>
        <title>The Scope of Morgellons</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Skip link for accessibility */}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:px-3 focus:py-2 focus:ring">
        Skip to main content
      </a>

      {/* App content */}
      <div id="main">
        <Component {...pageProps} supabase={supabase} session={session} />
      </div>

      {/* Auth overlay lives in _app.js. UI kept minimal and consistent with your current pattern. */}
      {shouldShowSignIn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h1 id="auth-title" className="mb-4 text-xl font-semibold">
              Welcome to The Scope of Morgellons
            </h1>

            <form onSubmit={onSubmitSignIn} aria-describedby="auth-status">
              <label className="mb-2 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                className="mb-4 w-full rounded border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-medium" htmlFor="password">
                  Password
                </label>
                {/* "?" password tips toggle */}
                <button
                  type="button"
                  aria-expanded={showPwTips ? "true" : "false"}
                  aria-controls="pw-tips"
                  onClick={() => setShowPwTips((v) => !v)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs"
                  title="Password tips"
                >
                  ?
                </button>
              </div>

              {showPwTips && (
                <div id="pw-tips" className="mb-2 rounded bg-gray-50 p-2 text-xs">
                  Use a strong password you can remember. If you forgot, use “Forgot password?” below.
                </div>
              )}

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mb-2 w-full rounded border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="mb-4">
                <a href="/auth/reset" className="text-sm underline">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                disabled={authBusy}
                aria-busy={authBusy ? "true" : "false"}
              >
                {authBusy ? "Signing in..." : "Sign in"}
              </button>

              {/* Live regions for status and errors */}
              <div id="auth-status" className="mt-3 text-sm" aria-live="polite">
                {authMsg ? <span className="text-green-700">{authMsg}</span> : null}
              </div>
              <div className="mt-1 text-sm" aria-live="assertive">
                {authErr ? <span className="text-red-700">{authErr}</span> : null}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Build badge (lifted above taskbar, bottom-right) */}
      <div
        aria-label="Build badge"
        className="fixed bottom-2 right-2 z-[1100] select-none rounded bg-black px-2 py-1 text-xs font-mono text-white shadow-lg"
      >
        Build {BUILD_TAG}
      </div>
    </>
  );
}






























