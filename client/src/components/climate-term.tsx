// ── <Term> / <MetricTip> — inline glossary terms with a hover/tap definition ──
// Drop-in: <Term k="heat_stress_day" /> renders the term with a dotted ember
// underline; hover (desktop) or tap (mobile, via focus) shows the plain-language
// definition. Self-contains its TooltipProvider so no app-root wiring is needed.
// <MetricTip k="heating_degree_days" value={2376}> wraps a number and shows a
// THREE-part tooltip: the term, what the unit means, and whether THIS value is
// high/low/typical and what it implies — so "2376 °C·days/yr" stops being noise.
// ponytail: built on Radix Tooltip (focus-driven on touch). If touch reliability
// ever bites, swap the Tooltip for a Popover — same glossary, same props.

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey, type GlossaryEntry } from "@/lib/glossary";
import { ACCENT, BORDER, CARD, MUTED } from "@/lib/climate-constants";

export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  if (!entry) return <>{children ?? k}</>;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${entry.label}: ${entry.definition}`}
            style={{
              all: "unset",
              cursor: "help",
              color: "inherit",
              borderBottom: `1px dotted ${ACCENT}`,
              paddingBottom: 0.5,
            }}
          >
            {children ?? entry.label}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          style={{
            maxWidth: 260,
            background: CARD,
            border: `1px solid ${BORDER}`,
            color: "white",
            borderRadius: 8,
            padding: "10px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{entry.label}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: MUTED }}>{entry.definition}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// <MetricTip> — wraps a rendered number/value so the tooltip explains the term,
// the unit, AND whether this specific value is high/low/typical. Pass the raw
// numeric `value` so the glossary's value-aware `interpret()` can read it; when a
// term has no interpreter (or value is null) it degrades to a plain definition.
export function MetricTip({
  k,
  value,
  children,
}: {
  k: GlossaryKey;
  value?: number | null;
  children: ReactNode;
}) {
  const entry = GLOSSARY[k] as GlossaryEntry | undefined;
  if (!entry) return <>{children}</>;
  const reading =
    entry.interpret && value != null && Number.isFinite(value) ? entry.interpret(value) : null;
  const aria = reading
    ? `${entry.label}: ${entry.definition} ${reading}`
    : `${entry.label}: ${entry.definition}`;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={aria}
            style={{
              all: "unset",
              cursor: "help",
              color: "inherit",
              borderBottom: `1px dotted ${ACCENT}`,
              paddingBottom: 0.5,
            }}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          style={{
            maxWidth: 280,
            background: CARD,
            border: `1px solid ${BORDER}`,
            color: "white",
            borderRadius: 8,
            padding: "10px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{entry.label}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: MUTED }}>{entry.definition}</div>
          {reading && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "white", marginTop: 6, fontWeight: 600 }}>
              {reading}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
