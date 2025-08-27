// pages/_app.js
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [session, setSession] = useState(null);

  // Track auth state so "/" can show sign-in when logged out
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );
    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const isHome = router.pathname === "/";

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>The Scope of Morgellons</title>
      </Head>

      {/* On home route, show sign-in UI when logged out. Otherwise render the page normally. */}
      {isHome && !session ? (
        <SignInScreen supabase={supabase} onSignedIn={() => router.replace("/")} />
      ) : (
        <Component {...pageProps} />
      )}

      <BuildBadge />
      <GlobalStyles />
    </>
  );
}

/**
 * Sign-in UI lives only here. Keep layout and copy the same.
 * This step only tightens the vertical space between “Welcome to” and the title.
 */
function SignInScreen({ supabase, onSignedIn }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");

  // Note: Sign-in behavior will be verified next step (36.130).
  // The UI here is unchanged except for the small spacing tweak.
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Intentionally minimal user feedback for this step
    try {
      setStatus("Signing in…");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("");
      onSignedIn?.();
    } catch (err) {
      setStatus("Unable to sign in right now.");
    }
  };

  return (
    <main id="main" className="auth-wrap" aria-describedby="auth-status">
      <div className="card">
        <header className="brand">
          {/* Spacing tweak is here: stack with tight gap */}
          <div className="welcome-stack" aria-hidden="true">
            <span className="welcome-to">Welcome to</span>
            <h1 className="site-title">The Scope of Morgellons</h1>
          </div>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <div className="pw-row">
            <label className="label" htmlFor="password">Password</label>
            <button
              type="button"
              aria-label="Password tips"
              className="tip-btn"
              onClick={() => setShowTips((s) => !s)}
            >
              ?
            </button>
          </div>

          <div className="pw-input-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {showTips && (
            <div className="tips" role="note">
              Use a unique password. Avoid common phrases. If you forgot it, use the link below.
            </div>
          )}

          <button type="submit" className="primary">Sign in</button>

          <p className="aux">
            <a href="/auth/reset" className="link">Forgot password?</a>
          </p>

          <p id="auth-status" className="status" aria-live="polite">
            {status}
          </p>
        </form>
      </div>
    </main>
  );
}

function BuildBadge() {
  // Single source of truth for the build tag
  const build = "Build 36.129_2025-08-26";
  return (
    <div className="build-badge" aria-label="Build badge">
      {build}
    </div>
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      :root {
        --bg: #0b0b0b;
        --panel: #141414;
        --text: #eaeaea;
        --muted: #b3b3b3;
        --accent: #4f9cf9;
        --border: #262626;
      }
      html, body, #__next { height: 100%; }
      body {
        margin: 0;
        color: var(--text);
        background: var(--bg);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }

      /* Auth shell */
      .auth-wrap {
        min-height: 100%;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 480px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      }

      /* Brand block with tightened stack */
      .brand {
        text-align: center;
        margin-bottom: 20px;
      }
      .welcome-stack {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        line-height: 1;
      }
      .welcome-to {
        font-size: clamp(14px, 2.1vw, 18px);
        font-weight: 500;
        letter-spacing: 0.01em;
        margin: 0 0 2px 0;   /* Tight tuck */
      }
      .site-title {
        font-size: clamp(28px, 6.5vw, 44px);
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0;          /* Remove default h1 margin to close the gap */
      }

      /* Form */
      .form { display: grid; gap: 12px; }
      .label {
        font-size: 14px;
        color: var(--muted);
      }
      .input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        background: #0f0f0f;
        border: 1px solid var(--border);
        color: var(--text);
      }
      .pw-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tip-btn {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #0f0f0f;
        color: var(--text);
        cursor: pointer;
      }
      .pw-input-wrap {
        position: relative;
      }
      .reveal {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        color: var(--muted);
        border: 0;
        cursor: pointer;
      }
      .primary {
        display: inline-block;
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--accent);
        color: #07121f;
        border: 0;
        font-weight: 700;
        cursor: pointer;
      }
      .aux {
        margin: 6px 0 0 0;
        text-align: center;
      }
      .link {
        color: var(--muted);
        text-decoration: underline;
      }
      .tips {
        font-size: 13px;
        color: var(--muted);
        background: #101010;
        border: 1px solid var(--border);
        padding: 10px;
        border-radius: 10px;
      }
      .status {
        min-height: 1.25em;
        font-size: 13px;
        color: var(--muted);
        text-align: center;
      }

      /* Build badge */
      .build-badge {
        position: fixed;
        right: 10px;
        bottom: 10px;
        background: rgba(20,20,20,0.9);
        border: 1px solid var(--border);
        color: var(--muted);
        padding: 6px 10px;
        border-radius: 10px;
        font-size: 12px;
        pointer-events: none;
        z-index: 9999;
      }
    `}</style>
  );
}


