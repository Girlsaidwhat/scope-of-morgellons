// pages/debug-public.js
import fs from "fs";
import path from "path";

export async function getStaticProps() {
  const pubDir = path.join(process.cwd(), "public");
  let files = [];
  try {
    files = fs.readdirSync(pubDir).sort();
  } catch (e) {
    files = ["<public not readable>", String(e?.message || e)];
  }
  return { props: { files } };
}

export default function DebugPublic({ files }) {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Debug: public directory contents</h1>
      <p>If your image is in the deployed artifact, it will be listed below.</p>
      <ul>
        {files.map((f) => (
          <li key={f}>
            <code>{f}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
