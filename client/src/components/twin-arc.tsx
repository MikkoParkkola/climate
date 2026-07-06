import { CARD, BORDER, MUTED, ACCENT, BLUE, FONT_MONO } from "@/lib/climate-constants";

const W = 660;
const H = 300;
const proj = (lat: number, lng: number) => ({ x: ((lng + 180) / 360) * W, y: ((90 - lat) / 180) * H });

// The climate twin as a picture: an equirectangular world with a faint
// graticule, an ember arc from the searched city to its present-day analog, and
// a marker whose size grows as the match weakens. No map tiles (Replit-cheap) —
// just a static projection. When there's no analog, the arc is absent and the
// card says so plainly (DESIGN.md §9 honesty).
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
  const a = proj(from.lat, from.lng);
  const b = !noAnalog && to ? proj(to.lat, to.lng) : null;
  const ctrl = b ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.22 - 24 } : null;
  const markerR = matchLabel === "strong" ? 4.5 : matchLabel === "moderate" ? 6.5 : 9;
  const grat = "hsl(220, 13%, 20%)";

  const label = (p: { x: number; y: number }, text: string, color: string) => {
    const anchor = p.x > W - 120 ? "end" : p.x < 120 ? "start" : "middle";
    const dx = anchor === "end" ? -7 : anchor === "start" ? 7 : 0;
    const dy = p.y < 26 ? 18 : -10;
    return (
      <text x={p.x + dx} y={p.y + dy} textAnchor={anchor} fontFamily="var(--font-mono)" fontSize={12} fill={color}>
        {text}
      </text>
    );
  };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        Climate twin
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={noAnalog ? `${from.name} has no present-day climate analog` : `${from.name}'s future climate resembles ${to?.name} today`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[-120, -60, 0, 60, 120].map((lng) => {
          const x = proj(0, lng).x;
          return <line key={`v${lng}`} x1={x} y1={0} x2={x} y2={H} stroke={grat} strokeWidth={lng === 0 ? 1 : 0.5} />;
        })}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const y = proj(lat, 0).y;
          return <line key={`h${lat}`} x1={0} y1={y} x2={W} y2={y} stroke={grat} strokeWidth={lat === 0 ? 1 : 0.5} />;
        })}
        {b && ctrl && (
          <path d={`M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`} fill="none" stroke={ACCENT} strokeWidth={1.6} opacity={0.85} />
        )}
        <circle cx={a.x} cy={a.y} r={4.5} fill={ACCENT} />
        {b && <circle cx={b.x} cy={b.y} r={markerR} fill="none" stroke={ACCENT} strokeWidth={2} />}
        {b && <circle cx={b.x} cy={b.y} r={2} fill={ACCENT} />}
        {label(a, from.name, ACCENT)}
        {b && to && label(b, `${to.name} (today)`, "hsl(220, 16%, 82%)")}
        {noAnalog && <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={13} fill={BLUE}>no present-day match</text>}
      </svg>
      <div style={{ marginTop: 6, fontSize: 12.5, color: "hsl(220, 16%, 88%)", lineHeight: 1.4 }}>
        {noAnalog
          ? `${from.name}'s projected climate has no close present-day equivalent in the catalog.`
          : `${from.name}'s future climate is a ${matchLabel} match for ${to?.name} today. Bigger ring = weaker match.`}
      </div>
    </div>
  );
}
