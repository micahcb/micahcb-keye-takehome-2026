"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getReviewFileData,
  postReviewFileAction,
  postReviewRowAction,
  type ReviewAction,
} from "@/lib/review-api"

import { buildReviewGridCsv, downloadTextFile } from "./review-csv"
import { uniqSortedColumns } from "./review-columns"
import { canApplyAction, isAcceptOrDenyStatus } from "./review-eligibility"
import { formatCell, titleCaseStatus } from "./review-format"
import { statusStyles } from "./review-status-styles"
import {
  STICKY_ROW_LEFT_STYLE,
  STICKY_STATUS_LEFT_STYLE,
} from "./sticky-layout"
import type { ReviewWorkbenchProps, RowBundle } from "./types"

export type { DiffCell, DiffRow, RowBundle } from "./types"

export function ReviewWorkbench({
  fileId,
  summary,
  fullColumns,
  initialRows,
}: ReviewWorkbenchProps) {
  const [rows, setRows] = useState<RowBundle[]>(initialRows)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [pendingAllRows, setPendingAllRows] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(Math.max(0, rows.length - 1))
  }, [rows.length, selectedIndex])

  const columns = useMemo(
    () => (fullColumns.length > 0 ? fullColumns : uniqSortedColumns(rows)),
    [fullColumns, rows],
  )

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
      if (!canApplyAction(bundle.row.status, action)) return
      setBusy(true)
      setPendingRowId(bundle.row.id)
      setPendingAllRows(false)
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
        setPendingRowId(null)
        setBusy(false)
      }
    },
    [applyRowStatus, busy, fileId, rows, selectedIndex, showToast],
  )

  const runFileAction = useCallback(
    async (action: ReviewAction) => {
      if (busy) return
      if (!rows.some((bundle) => canApplyAction(bundle.row.status, action))) return
      setBusy(true)
      setPendingAllRows(true)
      setPendingRowId(null)
      try {
        await postReviewFileAction(fileId, action)
        const statusMap: Record<ReviewAction, string> = {
          accept: "accepted",
          reject: "denied",
          revert: "suggested",
        }
        const next = statusMap[action]
        setRows((prev) =>
          prev.map((bundle) =>
            canApplyAction(bundle.row.status, action)
              ? { ...bundle, row: { ...bundle.row, status: next } }
              : bundle,
          ),
        )
        showToast(`All rows: ${titleCaseStatus(next)}`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Action failed")
      } finally {
        setPendingAllRows(false)
        setBusy(false)
      }
    },
    [busy, fileId, rows, showToast],
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
  const canAcceptSelected = selectedBundle ? canApplyAction(selectedBundle.row.status, "accept") : false
  const canRejectSelected = selectedBundle ? canApplyAction(selectedBundle.row.status, "reject") : false
  const canRevertSelected = selectedBundle ? canApplyAction(selectedBundle.row.status, "revert") : false
  const canAcceptAny = rows.some((bundle) => canApplyAction(bundle.row.status, "accept"))
  const canRejectAny = rows.some((bundle) => canApplyAction(bundle.row.status, "reject"))
  const canRevertAny = rows.some((bundle) => canApplyAction(bundle.row.status, "revert"))
  const allLoadedRowsAcceptOrDeny = useMemo(
    () => rows.length > 0 && rows.every((b) => isAcceptOrDenyStatus(b.row.status)),
    [rows],
  )
  const canExport =
    Boolean(fileId) &&
    rows.length > 0 &&
    allLoadedRowsAcceptOrDeny &&
    rows.some((b) => b.diffs.length > 0)

  const runExport = useCallback(async () => {
    if (!canExport || !fileId) return
    setBusy(true)
    try {
      const data = await getReviewFileData(fileId, 10_000)
      const freshRows = data.rows ?? []
      if (freshRows.length === 0) {
        showToast("Nothing to export.")
        return
      }
      const unresolved = freshRows.filter((b) => !isAcceptOrDenyStatus(b.row.status))
      if (unresolved.length > 0) {
        showToast(
          "Export is only available after every row is accepted or denied. Refresh if your list is out of date.",
        )
        return
      }
      const fullRowById = new Map(rows.map((b) => [b.row.id, b.fullRow]))
      const merged: RowBundle[] = freshRows.map((b) => ({
        row: b.row,
        diffs: b.diffs,
        fullRow: fullRowById.get(b.row.id),
      }))
      const exportColumns =
        fullColumns.length > 0 ? fullColumns : uniqSortedColumns(merged)
      const csv = buildReviewGridCsv(merged, exportColumns)
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const shortId = fileId.replace(/-/g, "").slice(0, 8)
      downloadTextFile(csv, `keye-review-${shortId}-${stamp}.csv`, "text/csv")
      showToast("Exported CSV download started")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed")
    } finally {
      setBusy(false)
    }
  }, [canExport, fileId, fullColumns, rows, showToast])

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
              disabled={busy || !fileId || rows.length === 0 || !canAcceptAny}
              onClick={() => void runFileAction("accept")}
            >
              Accept all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
              disabled={busy || !fileId || rows.length === 0 || !canRejectAny}
              onClick={() => void runFileAction("reject")}
            >
              Deny all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
              disabled={busy || !fileId || rows.length === 0 || !canRevertAny}
              onClick={() => void runFileAction("revert")}
            >
              Revert all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none border-[#89b4fa] text-[#89b4fa] hover:bg-[#89b4fa]/10"
              disabled={busy || !canExport}
              title={
                canExport
                  ? "Download a CSV that matches this table: accepted rows use suggested values; denied rows keep originals."
                  : "Accept or deny every row (including any not shown on this page) before exporting."
              }
              onClick={() => void runExport()}
            >
              Export CSV
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
                      <span className={statusStyles(selectedBundle.row.status, true)}>
                        {titleCaseStatus(selectedBundle.row.status)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 font-ui">
                  {busy && (
                    <span className="inline-flex items-center text-xs text-[#c9d2df]" role="status">
                      <span
                        className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#f5f0e8] border-t-transparent"
                        aria-hidden="true"
                      />
                      Updating status...
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !selectedBundle || !canAcceptSelected}
                    className="rounded-none bg-[#f5f0e8] text-[#0a1628] hover:bg-[#efe8dd]"
                    onClick={() => void runRowAction("accept")}
                  >
                    Accept row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !selectedBundle || !canRejectSelected}
                    className="rounded-none border-[#f5f0e8] text-[#f5f0e8]"
                    onClick={() => void runRowAction("reject")}
                  >
                    Deny row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !selectedBundle || !canRevertSelected}
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
                      <th
                        className="sticky z-[41] box-border overflow-hidden border-r border-[#d6cfc3] bg-[#efe8dd] px-2 py-2 font-medium shadow-[3px_0_0_0_#efe8dd]"
                        style={STICKY_ROW_LEFT_STYLE}
                      >
                        Row
                      </th>
                      <th
                        className="sticky z-[42] box-border overflow-hidden border-r border-[#d6cfc3] bg-[#efe8dd] py-2 pl-[10px] pr-2 font-medium shadow-[3px_0_0_0_#efe8dd]"
                        style={STICKY_STATUS_LEFT_STYLE}
                      >
                        Status
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="relative z-10 min-w-[140px] whitespace-nowrap border-r border-[#d6cfc3] bg-[#efe8dd] px-2 py-2 font-medium last:border-r-0"
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
                      const rowCrackCover = isSelected
                        ? "shadow-[3px_0_0_0_#eaf1fe]"
                        : "shadow-[3px_0_0_0_#fffbf5] group-hover:shadow-[3px_0_0_0_#f7f4ee]"
                      const statusCrackCover = rowCrackCover
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
                            className={`sticky z-[21] box-border overflow-hidden truncate border-r border-[#d6cfc3] px-2 py-1.5 tabular-nums font-medium text-[#0a1628] ${stickyBg} ${rowCrackCover}`}
                            style={STICKY_ROW_LEFT_STYLE}
                          >
                            {bundle.row.source_row_idx}
                          </td>
                          <td
                            className={`sticky z-[22] box-border overflow-hidden border-r border-[#d6cfc3] py-1.5 pl-[10px] pr-2 ${stickyBg} ${statusCrackCover}`}
                            style={STICKY_STATUS_LEFT_STYLE}
                          >
                            {pendingAllRows || pendingRowId === bundle.row.id ? (
                              <span
                                className="inline-flex items-center rounded-none border border-[#89b4fa]/40 bg-[#89b4fa]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0a1628]"
                                role="status"
                              >
                                <span
                                  className="mr-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[#0a1628] border-t-transparent"
                                  aria-hidden="true"
                                />
                                Updating
                              </span>
                            ) : (
                              <span
                                className={[
                                  "inline-block rounded-none border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                  statusStyles(bundle.row.status),
                                ].join(" ")}
                              >
                                {bundle.row.status}
                              </span>
                            )}
                          </td>
                          {columns.map((col) => {
                            const d = diffByCol[col]
                            const fullRowValue = bundle.fullRow?.[col]
                            if (!d)
                              return (
                                <td
                                  key={col}
                                  className="border-r border-[#ebe4da] px-2 py-1.5 text-[#0a1628] last:border-r-0"
                                >
                                  {formatCell(fullRowValue)}
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
