import { useState } from "react";
import { CARD, BORDER, MUTED, ACCENT, BLUE, FONT_MONO } from "@/lib/climate-constants";
import { WORLD_OUTLINE_PATH } from "@/lib/world-outline";

const W = 660;
const H = 300;
const proj = (lat: number, lng: number) => ({ x: ((lng + 180) / 360) * W, y: ((90 - lat) / 180) * H });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// The climate twin as a picture: a world outline, auto-zoomed to frame the
// searched city and its present-day analog (so a near pair like Madrid->Albacete
// isn't a dot on a whole globe), with an ember arc, a marker that grows as the
// match weakens, and +/- zoom controls. No map tiles (Replit-cheap): a static
// SVG whose viewBox is the zoom.
export function TwinArc({
  from,
  to,
  matchLabel,
  noAnalog,
}: {
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string } | null;
  matchLabel: "strong" | "moderate" | "weak" | "none";
  noAnalog: boolean;
}) {
  const [zoom, setZoom] = useState(1); // 1 = fit-to-cities; >1 zoom in; <1 pull back
  const a = proj(from.lat, from.lng);
  const b = !noAnalog && to ? proj(to.lat, to.lng) : null;

  // Fit box around the point(s), padded, matched to the 660:300 aspect.
  const cx = b ? (a.x + b.x) / 2 : a.x;
  const cy = b ? (a.y + b.y) / 2 : a.y;
  let spanX = Math.max(b ? Math.abs(a.x - b.x) : 0, 34) * 2.6; // padding + a floor so close pairs stay readable
  let spanY = Math.max(b ? Math.abs(a.y - b.y) : 0, 22) * 2.6;
  const aspect = W / H;
  if (spanX / spanY < aspect) spanX = spanY * aspect;
  else spanY = spanX / aspect;
  spanX = clamp(spanX / zoom, 26, W);
  spanY = clamp(spanY / zoom, 26 / aspect, H);
  const vx = clamp(cx - spanX / 2, 0, W - spanX);
  const vy = clamp(cy - spanY / 2, 0, H - spanY);
  const k = spanX / W; // scale factor: keep markers/strokes/text a constant visual size at any zoom

  const ctrl = b ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.22 - 24 * k } : null;
  const markerR = (matchLabel === "strong" ? 4.5 : matchLabel === "moderate" ? 6.5 : 9) * k;
  const grat = "hsl(220, 13%, 20%)";

  const label = (p: { x: number; y: number }, text: string, color: string, dir: -1 | 1) => (
    <text x={p.x} y={p.y + (dir === -1 ? -9 : 15) * k} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={12 * k} fill={color}>
      {text}
    </text>
  );

  const btn = (sign: string, onClick: () => void, title: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      style={{ width: 26, height: 26, background: CARD, border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 4, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 15, lineHeight: 1 }}
    >
      {sign}
    </button>
  );

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>Climate twin</div>
        <div style={{ display: "flex", gap: 5 }}>
          {btn("−", () => setZoom((z) => clamp(z / 1.6, 0.5, 12)), "Zoom out")}
          {btn("+", () => setZoom((z) => clamp(z * 1.6, 0.5, 12)), "Zoom in")}
        </div>
      </div>
      <svg viewBox={`${vx} ${vy} ${spanX} ${spanY}`} role="img" aria-label={noAnalog ? `${from.name} has no present-day climate analog` : `${from.name}'s future climate resembles ${to?.name} today`} style={{ width: "100%", height: "auto", display: "block", background: "hsl(222, 16%, 9%)", borderRadius: 4 }}>
        <path d={WORLD_OUTLINE_PATH} fill="hsl(220, 13%, 15%)" stroke="hsl(220, 12%, 26%)" strokeWidth={0.4 * k} />
        {[-120, -60, 0, 60, 120].map((lng) => {
          const x = proj(0, lng).x;
          return <line key={`v${lng}`} x1={x} y1={0} x2={x} y2={H} stroke={grat} strokeWidth={(lng === 0 ? 1 : 0.5) * k} />;
        })}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const y = proj(lat, 0).y;
          return <line key={`h${lat}`} x1={0} y1={y} x2={W} y2={y} stroke={grat} strokeWidth={(lat === 0 ? 1 : 0.5) * k} />;
        })}
        {b && ctrl && <path d={`M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`} fill="none" stroke={ACCENT} strokeWidth={1.6 * k} opacity={0.9} />}
        <circle cx={a.x} cy={a.y} r={4.5 * k} fill={ACCENT} />
        {b && <circle cx={b.x} cy={b.y} r={markerR} fill="none" stroke={ACCENT} strokeWidth={2 * k} />}
        {b && <circle cx={b.x} cy={b.y} r={2 * k} fill={ACCENT} />}
        {label(a, from.name, ACCENT, -1)}
        {b && to && label(b, `${to.name} (today)`, "hsl(220, 16%, 82%)", 1)}
        {noAnalog && <text x={a.x} y={a.y + 16 * k} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={12 * k} fill={BLUE}>no present-day match</text>}
      </svg>
      <div style={{ marginTop: 6, fontSize: 12.5, color: "hsl(220, 16%, 88%)", lineHeight: 1.4 }}>
        {noAnalog
          ? `${from.name}'s projected climate has no close present-day equivalent in the catalog.`
          : `${from.name}'s future climate is a ${matchLabel} match for ${to?.name} today. Bigger ring = weaker match; use +/- to zoom.`}
      </div>
    </div>
  );
}
