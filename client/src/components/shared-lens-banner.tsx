// ── Shared-lens banner ────────────────────────────────────────────────────────
// Honesty guard for the share-URL viral loop. When a visitor arrives on a link that
// carries someone else's non-default habitability prefs, the scores they see are a
// personal *lens*, not the canonical grounded number. This banner says so, shows the
// standard score alongside, and offers one tap back to standard.
// Renders nothing for normal visits or once prefs are reset to default.

import { Eye, RotateCcw } from "lucide-react";
import { ACCENT, BORDER, FONT_MONO, MUTED } from "@/lib/climate-constants";
import { DEFAULT_PREFS, prefsAreDefault } from "@/lib/habitability";
import { arrivedViaSharedLens, usePrefs } from "@/lib/use-prefs";

export function SharedLensBanner({ standardScore, personalScore }: { standardScore: number | null; personalScore: number | null }) {
  const [prefs, setPrefs] = usePrefs();
  if (!arrivedViaSharedLens() || prefsAreDefault(prefs)) return null;

  const showScores = standardScore != null && personalScore != null;
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "10px 14px", marginBottom: 14, borderRadius: 10,
        border: `1px solid ${ACCENT}`, background: "hsla(24,88%,56%,0.08)",
      }}
    >
      <Eye style={{ width: 16, height: 16, color: ACCENT, flexShrink: 0 }} />
      <div style={{ fontSize: 13, lineHeight: 1.45, flex: 1, minWidth: 220 }}>
        <strong>You're viewing a shared custom lens.</strong>{" "}
        <span style={{ color: MUTED }}>
          Scores are weighted to someone else's preferences, not the standard.
          {showScores && (
            <>
              {" "}Standard score here:{" "}
              <b style={{ fontFamily: FONT_MONO, color: ACCENT }}>{Math.round(standardScore!)}</b>
              {" "}(you're seeing <b style={{ fontFamily: FONT_MONO }}>{Math.round(personalScore!)}</b>).
            </>
          )}
        </span>
      </div>
      <button
        onClick={() => setPrefs({ ...DEFAULT_PREFS })}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
          border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.05)", color: ACCENT,
          fontSize: 12, cursor: "pointer", flexShrink: 0,
        }}
      >
        <RotateCcw style={{ width: 13, height: 13 }} /> Reset to standard
      </button>
    </div>
  );
}
