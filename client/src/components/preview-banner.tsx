import { AlertTriangle } from "lucide-react";

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
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        backgroundColor: "rgba(245,158,11,0.12)",
        borderBottom: "1px solid rgba(245,158,11,0.35)",
        color: "#fcd34d",
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden />
      <span>
        <strong>Grounded forecast beta.</strong>{" "}
        Projections are based on CMIP6/IPCC data and documented on the methodology
        page. Treat them as decision support, not safety-critical advice.
      </span>
    </div>
  );
}
