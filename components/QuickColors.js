// components/QuickColors.js
// Build 36.27_2025-08-22
import Link from "next/link";

export default function QuickColors({
  baseHref,
  label = "Colors",
  colors = [],
  activeColor = "",
}) {
  const items = (colors || []).map((c) =>
    typeof c === "string" ? { label: c, value: c } : c
  );
  const active = (activeColor || "").toLowerCase();
  const activeItem =
    items.find((i) => (i.value || "").toLowerCase() === active) || null;

  const wrap = {
    display: "inline-flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    background: "#111",
    border: "1px solid #000",
    borderRadius: 999,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    padding: "6px 8px",
    color: "#fff",
    margin: "8px 0",
  };

  const titleChip = {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    marginRight: 2,
    lineHeight: 1,
  };

  // softer: a shade dimmer than before
  const chip = {
    display: "inline-block",
    border: "1px solid #c8c8c8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "#111",
    background: "#e9e9e9",
    textDecoration: "none",
    lineHeight: 1,
  };
  const chipActive = {
    ...chip,
    background: "#111",
    borderColor: "#111",
    color: "#fff",
  };

  return (
    <nav aria-label="Quick colors" style={wrap}>
      <span style={titleChip}>
        {label}
        {activeItem ? ` · ${activeItem.label}` : ""}
      </span>

      {items.map((item) => {
        const isActive = (item.value || "").toLowerCase() === active;
        const href = `${baseHref}?color=${encodeURIComponent(item.value)}`;
        return (
          <Link key={item.value} href={href} legacyBehavior>
            <a
              aria-label={`Filter by color ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              style={isActive ? chipActive : chip}
            >
              {item.label}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}




