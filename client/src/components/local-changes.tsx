import { CARD, BORDER, MUTED, RED, AMBER, BLUE, CYAN, ORANGE, FONT_MONO } from "@/lib/climate-constants";
import { deriveLocalChanges, type LocalChangeInput, type ChangeTone } from "@/lib/local-changes";

const toneColor: Record<ChangeTone, string> = {
  heat: RED,
  warm: ORANGE,
  cold: CYAN,
  sea: BLUE,
  dry: AMBER,
  wet: BLUE,
};

// "What changes here" — a few concrete, grounded local-change cards under the
// verdict. Renders nothing when the projection shows no meaningful change
// (blank-not-guess), so a mild place doesn't get a padded, alarmist row.
export function LocalChanges({ d, year }: { d: LocalChangeInput; year: number }) {
  const changes = deriveLocalChanges({ ...d, year });
  if (changes.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        What changes here by {year}
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {changes.map((c) => (
          <div
            key={c.key}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${toneColor[c.tone]}`, borderRadius: 4, padding: "10px 12px" }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: toneColor[c.tone], marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.4, color: "hsl(220, 16%, 90%)" }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
