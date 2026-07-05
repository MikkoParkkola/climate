import { Activity, AlertTriangle, BarChart3, BookOpen, Github } from "lucide-react";

/**
 * Grounded beta banner. Forecasts now come from the CMIP6/IPCC grid, but the
 * hindcast validation report and uncertainty UI are still follow-up work.
 * Non-dismissible by design: users should see the scope and limits everywhere.
 */
export default function PreviewBanner() {
  return (
    <div
      role="alert"
      style={{
        position: "relative",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        padding: "8px 16px",
        backgroundColor: "rgba(245,158,11,0.12)",
        borderBottom: "1px solid rgba(245,158,11,0.35)",
        color: "#fcd34d",
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 260, flex: "1 1 520px" }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden />
        <span>
          <strong>Grounded forecast beta.</strong>{" "}
          Projections use CMIP6/IPCC data. Treat them as decision support, not
          safety-critical advice.
        </span>
      </div>
      <nav aria-label="Forecast transparency links" style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
        <a
          href="/methodology"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#fde68a", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 600 }}
        >
          <BookOpen size={14} aria-hidden />
          Methodology
        </a>
        <a
          href="/data-quality"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#fde68a", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 600 }}
        >
          <Activity size={14} aria-hidden />
          Data quality
        </a>
        <a
          href="/rankings"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#fde68a", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 600 }}
        >
          <BarChart3 size={14} aria-hidden />
          Rankings
        </a>
        <a
          href="https://github.com/MikkoParkkola/climate"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#fde68a", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 600 }}
        >
          <Github size={14} aria-hidden />
          Source
        </a>
      </nav>
    </div>
  );
}
