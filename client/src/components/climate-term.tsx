// ── <Term> — inline glossary term with a hover/tap definition ─────────────────
// Drop-in: <Term k="heat_stress_day" /> renders the term with a dotted ember
// underline; hover (desktop) or tap (mobile, via focus) shows the plain-language
// definition. Self-contains its TooltipProvider so no app-root wiring is needed.
// ponytail: built on Radix Tooltip (focus-driven on touch). If touch reliability
// ever bites, swap the Tooltip for a Popover — same glossary, same props.

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
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
