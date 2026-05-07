"use client"

import { useEffect, useState } from "react"

const PHASES = [
  {
    title: "Reading dataset",
    subtitle: "Streaming Parquet into memory",
    log: "decode_footer • column_chunks_ready",
  },
  {
    title: "Inferring column roles",
    subtitle: "Separating identity keys from numeric periods",
    log: "schema_signal ↑ confidence on ID / value split",
  },
  {
    title: "Scanning ledger patterns",
    subtitle: "Refunds, negative postings, booking collisions",
    log: "pattern_engine • heuristic sweep across rows",
  },
  {
    title: "Resolving conflicts",
    subtitle: "Merging identities and normalizing amounts",
    log: "merge_pass • deterministic tie-breakers applied",
  },
  {
    title: "Synthesizing diffs",
    subtitle: "Building suggested corrections cell-by-cell",
    log: "diff_generator • current ↔ proposed pairs materialized",
  },
  {
    title: "Committing review bundle",
    subtitle: "Persisting diff rows for human verification",
    log: "storage.flush • diff_rows + diffs upserted",
  },
] as const

type CleaningProgressOverlayProps = {
  active: boolean
}

export function CleaningProgressOverlay({ active }: CleaningProgressOverlayProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!active) {
      setPhase(0)
      return
    }
    setPhase(0)
    const interval = window.setInterval(() => {
      setPhase((p) => (p >= PHASES.length - 1 ? PHASES.length - 1 : p + 1))
    }, 820)
    return () => window.clearInterval(interval)
  }, [active])

  if (!active) return null

  const current = PHASES[phase]

  return (
    <div
      className="animate-cleaning-fade-in absolute inset-0 z-30 flex items-center justify-center bg-[#f5f0e8]/88 px-4 py-10 backdrop-blur-[10px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cleaning pipeline in progress"
    >
      <div className="cleaning-motion relative w-full max-w-lg overflow-hidden rounded-none border border-[#89b4fa]/45 bg-[#0a1628] p-6 shadow-[0_24px_80px_-12px_rgba(10,22,40,0.55)]">
        <div
          className="animate-cleaning-glow pointer-events-none absolute -top-1/2 left-1/2 size-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,#89b4fa35_0%,transparent_55%)] opacity-90 blur-3xl motion-reduce:animate-none"
          aria-hidden
        />
        <div
          className="animate-cleaning-orbit pointer-events-none absolute inset-0 opacity-[0.07] motion-reduce:animate-none"
          style={{
            backgroundImage:
              "linear-gradient(105deg, transparent 40%, #89b4fa 50%, transparent 60%)",
            backgroundSize: "180% 100%",
          }}
          aria-hidden
        />

        <div className="relative font-ui">
          <div className="flex items-start justify-between gap-4 border-b border-[#2b3f5d] pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#89b4fa]">
                Cleaning pipeline
              </p>
              <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight text-[#f5f0e8]">
                {current.title}
              </h2>
              <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-[#c9d2df]">
                {current.subtitle}
              </p>
            </div>
            <div className="flex shrink-0 gap-1 pt-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-[#89b4fa] motion-safe:animate-cleaning-dot-breathe"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-none bg-[#13233b]">
              <div className="animate-cleaning-bar h-full w-[38%] rounded-none bg-gradient-to-r from-[#5c7eb8] via-[#89b4fa] to-[#5c7eb8] bg-[length:200%_100%] motion-reduce:w-full motion-reduce:animate-none" />
            </div>
            <p className="text-[10px] text-[#7d8fa8]">
              Indeterminate progress — model blends rules & column statistics (single server pass).
            </p>
          </div>

          <ul className="mt-5 space-y-2 border-t border-[#2b3f5d] pt-4">
            {PHASES.map((step, i) => {
              const done = i < phase
              const live = i === phase
              return (
                <li
                  key={step.title}
                  className={[
                    "flex gap-3 text-xs transition-colors duration-300",
                    live ? "text-[#f5f0e8]" : done ? "text-[#9fb4cf]" : "text-[#5c6b82]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-none border text-[9px] font-mono leading-none",
                      done
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                        : live
                          ? "motion-safe:animate-cleaning-pulse-border border-[#89b4fa] bg-[#89b4fa]/15 text-[#89b4fa]"
                          : "border-[#2b3f5d] bg-[#13233b] text-[#5c6b82]",
                    ].join(" ")}
                    aria-hidden
                  >
                    {done ? "✓" : live ? "●" : i + 1}
                  </span>
                  <span className="leading-snug">
                    <span className="font-medium">{step.title}</span>
                    {live && (
                      <span className="mt-0.5 block font-mono text-[10px] text-[#89b4fa]/90 motion-safe:animate-cleaning-caret">
                        {step.log}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
