// pages/_app.js
import { useEffect, useState } from "react";
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

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const isHome = router.pathname === "/";

  return (
    <>
      <Head>
        <title>The Scope of Morgellons</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {isHome && !session ? (
        <SignInScreen />
      ) : (
        <Component {...pageProps} />
      )}

      <BuildBadge />
      <GlobalStyles />
    </>
  );
}

/**
 * Sign-in UI lives ONLY here.
 * This version retains your “?” tips + “Forgot password?” and makes a *tiny* spacing tuck:
 * the line “Welcome to” now sits very close to the H1 title.
 * No behavior changes yet (Step 36.130 will wire signInWithPassword).
 */
function SignInScreen() {
  const [showTips, setShowTips] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // No wiring changes in this step. Behavior will be updated in Step 36.130.
    setStatus("");
  };

  return (
    <main id="main" className="auth-wrap" aria-describedby="auth-status">
      <div className="card">
        <header className="brand" aria-label="Brand">
          {/* Tight spacing: welcome-line sits very close to the title */}
          <span className="welcome-to">Welcome to</span>
          <h1 className="site-title">The Scope of Morgellons</h1>
        </header>

        <form className="form" onSubmit={onSubmit}>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <div className="pw-head">
            <label htmlFor="password" className="label">Password</label>
            <button
              type="button"
              className="tip-btn"
              aria-label="Password tips"
              onClick={() => setShowTips((v) => !v)}
            >
              ?
            </button>
          </div>

          <div className="pw-wrap">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className="input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="reveal"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {showTips && (
            <div className="tips" role="note" aria-live="polite">
              Use a unique password you don’t use elsewhere. If you forgot it, use “Forgot password?” below.
            </div>
          )}

          <button type="submit" className="primary">Sign in</button>

          <p className="aux">
            <a className="link" href="/auth/reset">Forgot password?</a>
          </p>

          <p id="auth-status" className="status" aria-live="polite">{status}</p>
        </form>
      </div>
    </main>
  );
}

function BuildBadge() {
  const build = "Build 36.129_2025-08-26";
  return <div className="build-badge">{build}</div>;
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
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial;
      }

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

      /* Brand header — only change is the tiny gap reduction */
      .brand {
        text-align: center;
        margin-bottom: 20px;
      }
      .welcome-to {
        display: block;
        font-size: clamp(14px, 2.1vw, 18px);
        font-weight: 500;
        letter-spacing: 0.01em;
        margin: 0 0 2px 0; /* tuck */
        line-height: 1;
      }
      .site-title {
        font-size: clamp(28px, 6.5vw, 44px);
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0; /* remove default h1 top margin to close gap */
        line-height: 1.05;
      }

      .form { display: grid; gap: 12px; }
      .label { font-size: 14px; color: var(--muted); }
      .input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        background: #0f0f0f;
        border: 1px solid var(--border);
        color: var(--text);
      }
      .pw-head {
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
      .pw-wrap { position: relative; }
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
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--accent);
        color: #07121f;
        border: 0;
        font-weight: 700;
        cursor: pointer;
      }
      .aux { margin: 6px 0 0; text-align: center; }
      .link { color: var(--muted); text-decoration: underline; }
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

