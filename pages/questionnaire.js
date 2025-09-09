// pages/questionnaire.js
// My Story page: top section unified with Profile via SignedInHeader.
// Keeps skip link and <main id="main"> for accessibility.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import SignedInHeader from "../components/SignedInHeader";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FEEDBACK_TO = "girlsaidwhat@gmail.com";
function feedbackHref(contextLabel = "My Story") {
  const subject = `${contextLabel} – Scope feedback`;
  const page = typeof window !== "undefined" ? window.location.href : "/questionnaire";
  const body = `Page: ${page}\n\nWhat happened:\n`;
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function MyStoryPage() {
  const router = useRouter();
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

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  // Skip link
  const skipStyle = {
    position: "absolute",
    left: -9999,
    top: "auto",
    width: 1,
    height: 1,
    overflow: "hidden",
  };

  if (checking) return null;

  if (!user) {
    return (
      <>
        <a href="#main" style={skipStyle}>Skip to content</a>
        <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>My Story</h1>
          <p style={{ marginTop: 8 }}>Please sign in to access My Story.</p>
          <nav aria-label="Links" style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <a href="/signin" style={{ textDecoration: "underline" }}>Sign in</a>
            <a href="/" style={{ textDecoration: "none" }}>Back to Home</a>
          </nav>
        </main>
      </>
    );
  }

  const feedbackLink = feedbackHref("My Story");

  return (
    <>
      <a href="#main" style={skipStyle}>Skip to content</a>
      <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <SignedInHeader
          title="My Story"
          leftLinks={[
            { href: "/", label: "Back to Profile" },
            { href: "/upload", label: "Go to Uploads" },
          ]}
          onSignOut={handleSignOut}
          feedbackHref={feedbackLink}
        />

        <section
          aria-label="My Story intro"
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <p style={{ margin: 0 }}>
            This page will feature a questionnaire for symptoms, how long you've been sick, whether
            you received formal Lyme (and other coinfections) diagnoses, space for your story as far
            as the disease goes, and a space to talk about the personal impact Morgellons has had on your life.
          </p>
        </section>
      </main>
    </>
  );
}
