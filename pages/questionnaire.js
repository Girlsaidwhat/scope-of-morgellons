// pages/questionnaire.js
// Microburst: minimal "My Story" shell with placeholder copy

export default function MyStoryPage() {
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>My Story</h1>
      </header>

      <p style={{ fontSize: 16, lineHeight: 1.7 }}>
        This page will feature a questionnaire for symptoms, how long you've been sick, did you get a formal Lyme (and other coinfections) diagnosis,
        space for your story as far as the disease goes, a space for you to talk about the personal impact Morgellons has had on your life, etc.
      </p>
    </main>
  );
}
