// pages/profile.js
export default function Profile() {
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Your Profile</h1>
        <p style={{ marginTop: 6, opacity: 0.85 }}>
          Static page using an image from <code>/public/profile-portrait.jpg</code>.
        </p>
      </header>

      <section
        aria-label="Profile section"
        style={{ display: "grid", gridTemplateColumns: "315px 1fr", gap: 16, alignItems: "start" }}
      >
        <aside
          role="complementary"
          aria-label="Profile portrait"
          title="Profile portrait"
          style={{ width: 315, height: 429, borderRadius: 12, overflow: "hidden", background: "#f3f4f6",
                   display: "grid", placeItems: "center" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/profile-portrait.jpg"
            alt="Profile portrait"
            width={315}
            height={429}
            style={{ width: 315, height: 429, objectFit: "contain", display: "block" }}
          />
        </aside>

        <div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>About You</h2>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Write a short intro here. Later we can hook this up to real profile data.
          </p>
        </div>
      </section>
    </main>
  );
}
