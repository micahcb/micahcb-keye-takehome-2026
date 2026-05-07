"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  postReviewFileAction,
  postReviewRowAction,
  type ReviewAction,
} from "@/lib/review-api"

export type DiffCell = {
  id: string
  column_id: string
  suggested_val: number | null
  current_val: number | null
}

export type DiffRow = {
  id: string
  source_row_idx: number
  status: string
}

export type RowBundle = { row: DiffRow; diffs: DiffCell[] }

type ReviewWorkbenchProps = {
  fileId: string
  summary: {
    rowCount: string
    cellCount: string
    rowsAdded: string
    diffsAdded: string
  }
  initialRows: RowBundle[]
}

function titleCaseStatus(status: string): string {
  if (!status) return "Suggested"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatCell(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e7 || (abs > 0 && abs < 1e-4)) return n.toExponential(2)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function columnSortKey(name: string): string | number[] {
  const parts = name.split("_")
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) {
    return parts.map((p) => Number.parseInt(p, 10))
  }
  return name
}

function uniqSortedColumns(rows: RowBundle[]): string[] {
  const set = new Set<string>()
  for (const bundle of rows) {
    for (const d of bundle.diffs) set.add(d.column_id)
  }
  return [...set].sort((a, b) => {
    const ka = columnSortKey(a)
    const kb = columnSortKey(b)
    if (Array.isArray(ka) && Array.isArray(kb)) {
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const da = ka[i] ?? 0
        const db = kb[i] ?? 0
        if (da !== db) return da - db
      }
      return 0
    }
    return String(ka).localeCompare(String(kb))
  })
}

function statusStyles(status: string): string {
  const s = status.toLowerCase()
  if (s === "accepted") return "bg-emerald-500/15 text-emerald-900 border-emerald-700/30"
  if (s === "denied") return "bg-destructive/10 text-destructive border-destructive/30"
  return "bg-[#89b4fa]/15 text-[#0a1628] border-[#89b4fa]/40"
}

export function ReviewWorkbench({ fileId, summary, initialRows }: ReviewWorkbenchProps) {
  const [rows, setRows] = useState<RowBundle[]>(initialRows)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(Math.max(0, rows.length - 1))
  }, [rows.length, selectedIndex])

  const columns = useMemo(() => uniqSortedColumns(rows), [rows])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const applyRowStatus = useCallback((rowId: string, status: string) => {
    setRows((prev) =>
      prev.map((bundle) =>
        bundle.row.id === rowId ? { ...bundle, row: { ...bundle.row, status } } : bundle,
      ),
    )
  }, [])

  const runRowAction = useCallback(
    async (action: ReviewAction) => {
      const bundle = rows[selectedIndex]
      if (!bundle || busy) return
      setBusy(true)
      try {
        const data = (await postReviewRowAction(fileId, bundle.row.id, action)) as {
          status?: string
        }
        const next = data.status ?? bundle.row.status
        applyRowStatus(bundle.row.id, next)
        showToast(`Row ${bundle.row.source_row_idx + 1}: ${titleCaseStatus(next)}`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Action failed")
      } finally {
        setBusy(false)
      }
    },
    [applyRowStatus, busy, fileId, rows, selectedIndex, showToast],
  )

  const runFileAction = useCallback(
    async (action: ReviewAction) => {
      if (busy) return
      setBusy(true)
      try {
        await postReviewFileAction(fileId, action)
        const statusMap: Record<ReviewAction, string> = {
          accept: "accepted",
          reject: "denied",
          revert: "suggested",
        }
        const next = statusMap[action]
        setRows((prev) =>
          prev.map((bundle) => ({ ...bundle, row: { ...bundle.row, status: next } })),
        )
        showToast(`All rows: ${titleCaseStatus(next)}`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Action failed")
      } finally {
        setBusy(false)
      }
    },
    [busy, fileId, showToast],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }
      if (busy || rows.length === 0) return

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(rows.length - 1, i + 1))
        return
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(0, i - 1))
        return
      }

      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === "Enter") {
        e.preventDefault()
        void runRowAction("accept")
        return
      }
      if (e.key === "a" || e.key === "A") {
        if (!meta) {
          e.preventDefault()
          void runRowAction("accept")
        }
        return
      }
      if (e.key === "d" || e.key === "D") {
        if (!meta) {
          e.preventDefault()
          void runRowAction("reject")
        }
        return
      }
      if (e.key === "z" || e.key === "Z") {
        if (!meta) {
          e.preventDefault()
          void runRowAction("revert")
        }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [busy, rows.length, runRowAction])

  const selectedBundle = rows[selectedIndex]

  return (
    <div className="flex min-h-svh flex-col">
      <header className="section-dark border-b border-[#2b3f5d] px-6 py-5">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#f5f0e8]">
              Review changes
            </h1>
            <p className="mt-1 max-w-xl font-sans text-sm text-[#c9d2df]">
              Spreadsheet-style diff review. Select a row, then accept, deny, or revert — use
              keyboard shortcuts like an editor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 font-ui">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
              disabled={busy || !fileId || rows.length === 0}
              onClick={() => void runFileAction("accept")}
            >
              Accept all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
              disabled={busy || !fileId || rows.length === 0}
              onClick={() => void runFileAction("reject")}
            >
              Deny all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
              disabled={busy || !fileId || rows.length === 0}
              onClick={() => void runFileAction("revert")}
            >
              Revert all
            </Button>
          </div>
        </div>
      </header>

      <div className="section-cream flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
          <div className="grid gap-3 rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-4 text-sm text-[#0a1628] sm:grid-cols-2 lg:grid-cols-4">
            <p>
              <span className="text-[#384865]">Rows with changes </span>
              <span className="font-medium">{summary.rowCount}</span>
            </p>
            <p>
              <span className="text-[#384865]">Cell changes </span>
              <span className="font-medium">{summary.cellCount}</span>
            </p>
            <p>
              <span className="text-[#384865]">Rows inserted </span>
              <span className="font-medium">{summary.rowsAdded}</span>
            </p>
            <p>
              <span className="text-[#384865]">Diff records </span>
              <span className="font-medium">{summary.diffsAdded}</span>
            </p>
          </div>

          {toast && (
            <div
              className="rounded-none border border-[#89b4fa] bg-[#eaf1fe] px-4 py-2 text-sm text-[#0a1628]"
              role="status"
            >
              {toast}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-[#384865]">No suggested diffs for this file.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border border-[#d6cfc3] bg-[#0a1628] px-4 py-3 text-[#f5f0e8]">
                <div className="font-ui text-xs text-[#c9d2df]">
                  <span className="text-[#89b4fa]">Selected</span>{" "}
                  {selectedBundle ? (
                    <>
                      source row index <strong>{selectedBundle.row.source_row_idx}</strong>
                      <span className="mx-2 text-[#5c6b82]">·</span>
                      <span className={statusStyles(selectedBundle.row.status)}>
                        {titleCaseStatus(selectedBundle.row.status)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="flex flex-wrap gap-2 font-ui">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !selectedBundle}
                    className="rounded-none bg-[#f5f0e8] text-[#0a1628] hover:bg-[#efe8dd]"
                    onClick={() => void runRowAction("accept")}
                  >
                    Accept row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !selectedBundle}
                    className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
                    onClick={() => void runRowAction("reject")}
                  >
                    Deny row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !selectedBundle}
                    className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
                    onClick={() => void runRowAction("revert")}
                  >
                    Revert row
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-none border border-[#d6cfc3] bg-[#fffbf5] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <table className="min-w-max border-collapse font-ui text-xs">
                  <thead>
                    <tr className="border-b border-[#d6cfc3] bg-[#efe8dd] text-left text-[#0a1628]">
                      <th className="sticky left-0 z-20 min-w-[52px] border-r border-[#d6cfc3] px-2 py-2 font-medium">
                        #
                      </th>
                      <th className="sticky left-[52px] z-20 min-w-[120px] border-r border-[#d6cfc3] px-2 py-2 font-medium">
                        Row
                      </th>
                      <th className="sticky left-[172px] z-20 min-w-[100px] border-r border-[#d6cfc3] px-2 py-2 font-medium">
                        Status
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="min-w-[140px] whitespace-nowrap border-r border-[#d6cfc3] px-2 py-2 font-medium last:border-r-0"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((bundle, idx) => {
                      const isSelected = idx === selectedIndex
                      const diffByCol = Object.fromEntries(
                        bundle.diffs.map((d) => [d.column_id, d]),
                      )
                      const stickyBg = isSelected
                        ? "bg-[#eaf1fe]"
                        : "bg-[#fffbf5] group-hover:bg-[#f7f4ee]"
                      return (
                        <tr
                          key={bundle.row.id}
                          className={[
                            "group cursor-pointer border-b border-[#ebe4da] transition-colors duration-200",
                            isSelected
                              ? "bg-[#eaf1fe] ring-1 ring-inset ring-[#89b4fa]"
                              : "bg-[#fffbf5] hover:bg-[#f7f4ee]",
                          ].join(" ")}
                          onClick={() => setSelectedIndex(idx)}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-[#d6cfc3] px-2 py-1.5 tabular-nums text-[#384865] ${stickyBg}`}
                          >
                            {idx + 1}
                          </td>
                          <td
                            className={`sticky left-[52px] z-10 border-r border-[#d6cfc3] px-2 py-1.5 tabular-nums font-medium text-[#0a1628] ${stickyBg}`}
                          >
                            {bundle.row.source_row_idx}
                          </td>
                          <td
                            className={`sticky left-[172px] z-10 border-r border-[#d6cfc3] px-2 py-1.5 ${stickyBg}`}
                          >
                            <span
                              className={[
                                "inline-block rounded-none border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                statusStyles(bundle.row.status),
                              ].join(" ")}
                            >
                              {bundle.row.status}
                            </span>
                          </td>
                          {columns.map((col) => {
                            const d = diffByCol[col]
                            if (!d)
                              return (
                                <td
                                  key={col}
                                  className="border-r border-[#ebe4da] px-2 py-1.5 text-[#c8c2b8] last:border-r-0"
                                >
                                  —
                                </td>
                              )
                            const changed =
                              d.current_val !== null &&
                              d.suggested_val !== null &&
                              Math.abs(d.current_val - d.suggested_val) > 1e-12
                            return (
                              <td
                                key={col}
                                className="border-r border-[#ebe4da] px-2 py-1.5 align-top last:border-r-0"
                              >
                                {changed ? (
                                  <div className="flex flex-col gap-0.5 leading-tight">
                                    <span className="text-[#384865] line-through decoration-[#384865]/50">
                                      {formatCell(d.current_val)}
                                    </span>
                                    <span className="font-medium text-[#0a1628]">
                                      {formatCell(d.suggested_val)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[#0a1628]">{formatCell(d.suggested_val)}</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="section-dark border-t border-[#2b3f5d] px-6 py-4">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 font-ui text-xs text-[#c9d2df] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                ↑↓
              </kbd>{" "}
              or{" "}
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                J
              </kbd>
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                K
              </kbd>{" "}
              Move selection
            </span>
            <span>
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                A
              </kbd>{" "}
              Accept row ·{" "}
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                D
              </kbd>{" "}
              Deny row ·{" "}
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                Z
              </kbd>{" "}
              Revert row
            </span>
            <span>
              <kbd className="rounded border border-[#2b3f5d] bg-[#13233b] px-1.5 py-0.5 font-mono text-[#f5f0e8]">
                ⌘↵
              </kbd>{" "}
              Accept row
            </span>
          </div>
          <p className="text-[#89b4fa]/90">Row-level only — no per-cell actions.</p>
        </div>
      </footer>
    </div>
  )
}
