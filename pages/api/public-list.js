// pages/api/public-list.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const pubDir = path.join(process.cwd(), "public");
    const entries = fs.readdirSync(pubDir).sort();
    res.status(200).json({ ok: true, entries });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
