import React, { useState } from "react";
import type { HintLadderData } from "../types";
import { MarkdownMath } from "./MarkdownMath";

interface HintLadderProps {
  hints: HintLadderData;
}

export const HintLadder: React.FC<HintLadderProps> = ({ hints }) => {
  const [revealedStep, setRevealedStep] = useState<number>(1);

  const steps = [
    {
      num: 1,
      label: "Step 01 · Nudge",
      subtitle: "Conceptual pointer",
      icon: "bx-compass",
      content: hints.nudge,
      color: "border-amber-500/40 bg-amber-500/5",
      badge: "text-amber-400 bg-amber-500/15",
    },
    {
      num: 2,
      label: "Step 02 · Hint",
      subtitle: "Key formula or relationship",
      icon: "bx-key",
      content: hints.hint,
      color: "border-blue-500/40 bg-blue-500/5",
      badge: "text-blue-400 bg-blue-500/15",
    },
    {
      num: 3,
      label: "Step 03 · Scaffold",
      subtitle: "Step-by-step derivation",
      icon: "bx-layer",
      content: hints.scaffold,
      color: "border-emerald-500/40 bg-emerald-500/5",
      badge: "text-emerald-400 bg-emerald-500/15",
    },
  ].filter((s) => s.content.trim().length > 0);

  if (steps.length === 0) return null;

  return (
    <div className="mt-2 space-y-2.5">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="font-medium uppercase tracking-wider text-amber-400">
          Socratic Hint Ladder
        </span>
        <span className="font-mono">
          {Math.min(revealedStep, steps.length)} of {steps.length} revealed
        </span>
      </div>

      {steps.map((step, idx) => {
        const stepIndex = idx + 1;
        const unlocked = stepIndex <= revealedStep;

        if (!unlocked) {
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => setRevealedStep(stepIndex)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)] transition text-left text-xs text-[var(--text-secondary)] cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <i className="bx bx-lock-open-alt text-sm text-[var(--accent-blue)]" />
                Unlock {step.label} ({step.subtitle})
              </span>
              <span className="text-[11px] text-[var(--accent-blue)] font-medium">Reveal →</span>
            </button>
          );
        }

        return (
          <div key={step.num} className={`rounded-xl border p-3.5 ${step.color}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${step.badge}`}
              >
                <i className={`bx ${step.icon} text-xs`} />
                {step.label}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">{step.subtitle}</span>
            </div>
            <MarkdownMath content={step.content} />
          </div>
        );
      })}
    </div>
  );
};
