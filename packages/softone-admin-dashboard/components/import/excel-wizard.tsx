"use client"

import { useState } from "react"
import { Check, FileSpreadsheet, Table, Plug, GitMerge, Rocket } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { DEFAULT_CONFIG, type ImportConfig } from "./types"
import { StepUpload } from "./step-upload"
import { StepSheet } from "./step-sheet"
import { StepTarget } from "./step-target"
import { StepMapping } from "./step-mapping"
import { StepReview } from "./step-review"

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Upload",  short: "File",    icon: FileSpreadsheet },
  { id: 2, label: "Sheet",   short: "Sheet",   icon: Table },
  { id: 3, label: "Target",  short: "Target",  icon: Plug },
  { id: 4, label: "Map",     short: "Mapping", icon: GitMerge },
  { id: 5, label: "Import",  short: "Import",  icon: Rocket },
] as const

type StepId = (typeof STEPS)[number]["id"]

// ─── Step validation ──────────────────────────────────────────────────────────

function canProceed(step: StepId, config: ImportConfig): boolean {
  switch (step) {
    case 1: return !!config.fileName
    case 2: return config.selectedColumns.length > 0
    case 3: return !!config.connectionId && !!config.bindingId && !!config.targetObjectKey
    case 4: return config.mappings.some(m => m.targetField)
    case 5: return true
  }
}

// ─── Stepper UI ───────────────────────────────────────────────────────────────

function Stepper({
  current,
  config,
  onGoTo,
}: {
  current: StepId
  config: ImportConfig
  onGoTo: (s: StepId) => void
}) {
  return (
    <div className="flex items-center justify-center select-none">
      {STEPS.map((step, idx) => {
        const done = step.id < current
        const active = step.id === current
        const reachable = step.id < current || (step.id === current)
        const Icon = step.icon

        return (
          <div key={step.id} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className="transition-all duration-500"
                style={{
                  width: 40,
                  height: 2,
                  background: done ? "var(--primary)" : "var(--border)",
                  margin: "0 4px",
                }}
              />
            )}

            {/* Step bubble */}
            <button
              onClick={() => reachable && onGoTo(step.id)}
              className="flex flex-col items-center gap-1.5 group"
              disabled={!reachable}
              style={{ cursor: reachable ? "pointer" : "default" }}
            >
              <div
                className="size-10 rounded-full flex items-center justify-center transition-all duration-300 relative"
                style={{
                  background: done ? "var(--primary)" : active ? "var(--primary)" : "var(--muted)",
                  border: `2px solid ${done || active ? "var(--primary)" : "var(--border)"}`,
                  boxShadow: active ? "0 0 0 4px var(--primary-light)" : "none",
                }}
              >
                {done ? (
                  <Check className="size-4 text-white" strokeWidth={3} />
                ) : (
                  <Icon
                    className="size-4"
                    style={{ color: active ? "#fff" : "var(--foreground-muted)" }}
                  />
                )}
              </div>
              <span
                className="text-[11px] font-medium hidden sm:block transition-colors"
                style={{ color: active ? "var(--primary)" : done ? "var(--foreground-muted)" : "var(--foreground-subtle)" }}
              >
                {step.label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function ExcelWizard() {
  const [step, setStep] = useState<StepId>(1)
  const [config, setConfig] = useState<ImportConfig>(DEFAULT_CONFIG)

  function patch(update: Partial<ImportConfig>) {
    setConfig(prev => ({ ...prev, ...update }))
  }

  function goTo(s: StepId) {
    // Allow jumping to any step that has been reached (back or forward within unlocked range)
    if (s <= step || canProceed(step, config)) setStep(s)
  }

  function next() {
    if (canProceed(step, config) && step < 5) setStep((step + 1) as StepId)
  }

  function back() {
    if (step > 1) setStep((step - 1) as StepId)
  }

  const canNext = canProceed(step, config)

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="rounded-2xl px-6 py-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <Stepper current={step} config={config} onGoTo={goTo} />
      </div>

      {/* Step content card */}
      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
          minHeight: 420,
        }}
      >
        {step === 1 && <StepUpload config={config} onChange={patch} />}
        {step === 2 && <StepSheet config={config} onChange={patch} />}
        {step === 3 && <StepTarget config={config} onChange={patch} />}
        {step === 4 && <StepMapping config={config} onChange={patch} />}
        {step === 5 && <StepReview config={config} onChange={patch} />}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {step > 1 && (
            <Btn variant="ghost" size="md" onClick={back}>
              ← Back
            </Btn>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Step counter */}
          <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            Step {step} of {STEPS.length}
          </span>

          {step < 5 && (
            <Btn
              variant="primary"
              size="md"
              disabled={!canNext}
              onClick={next}
            >
              {step === 4 ? "Review →" : "Continue →"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}
