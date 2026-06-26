import { AlertTriangle } from "lucide-react";

/**
 * Phase 0 honesty banner. The current projections are produced by a heuristic
 * (see docs/CURRENT_STATE.md), not a validated climate model. Until the
 * IPCC AR6 / CMIP6 pipeline ships (docs/PLAN.md), every projection MUST be
 * labeled as a non-scientific preview. Non-dismissible by design — hiding the
 * disclaimer would defeat its purpose. Remove only when forecasts are grounded.
 * ponytail: one global bar, mounted once in App.tsx; covers all routes.
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
        <strong>Preview &mdash; not scientifically validated.</strong>{" "}
        These projections come from a placeholder model and are being rebuilt on
        IPCC AR6 / CMIP6 data. Don&rsquo;t rely on them for real decisions yet.
      </span>
    </div>
  );
}
