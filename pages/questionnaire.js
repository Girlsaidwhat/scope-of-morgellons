// pages/questionnaire.js
// Minimal signed-in route; separate from Profile. No badge bump.

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FEEDBACK_TO = "girlsaidwhat@gmail.com";
function feedbackHref(contextLabel = "Questionnaire") {
  const subject = `${contextLabel} – Scope feedback`;
  const page = typeof window !== "undefined" ? window.location.href : "/questionnaire";
  const body = `Page: ${page}\n\nWhat happened:\n`;
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function QuestionnairePage() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
      setChecking(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // Simple “skip to content” link for a11y
  const skipStyle = {
    position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden",
  };

  if (checking) return null;

  if (!user) {
    return (
      <>
        <a href="#main" style={skipStyle}>Skip to content</a>
        <main id="main" tabIndex={-1} style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>Questionnaire</h1>
          <p style={{ marginTop: 8 }}>Please sign in to access the questionnaire.</p>
          <nav aria-label="Links" style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <a href="/signin" style={{ textDecoration: "underline" }}>Sign in</a>
            <a href="/" style={{ textDecoration: "none" }}>Back to Home</a>
          </nav>
        </main>
      </>
    );
  }

  return (
    <>
      <a href="#main" style={skipStyle}>Skip to content</a>
      <main id="main" tabIndex={-1} style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Questionnaire</h1>
          <a href={feedbackHref("Questionnaire")} aria-label="Send feedback about the Questionnaire page" style={{ fontSize: 12, textDecoration: "underline" }}>
            Send feedback
          </a>
        </header>

        <section aria-label="Questionnaire intro" style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12, background: "#fff" }}>
          <p style={{ margin: 0 }}>
            This page will host the intake questionnaire. It’s separate from your profile but linked from there.
          </p>
        </section>

        <nav aria-label="Page links" style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <a href="/" style={{ textDecoration: "none", fontWeight: 600 }}>Back to Home</a>
          <a href="/upload" style={{ textDecoration: "none", fontWeight: 600 }}>Go to Uploads</a>
        </nav>
      </main>
    </>
  );
}
