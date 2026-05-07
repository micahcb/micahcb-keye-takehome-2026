"use client"

import { Button } from "@/components/ui/button"

type SampleDataSelectorProps = {
  usingSampleData: boolean
  sampleDropdownOpen: boolean
  selectedSampleFile: string
  sampleFiles: string[]
  sampleListLoading?: boolean
  sampleListError?: string
  sampleDropdownRef: React.RefObject<HTMLDivElement | null>
  onUseSampleData: () => void
  onToggleDropdown: () => void
  onSelectSampleFile: (fileName: string) => void
}

export function SampleDataSelector({
  usingSampleData,
  sampleDropdownOpen,
  selectedSampleFile,
  sampleFiles,
  sampleListLoading = false,
  sampleListError = "",
  sampleDropdownRef,
  onUseSampleData,
  onToggleDropdown,
  onSelectSampleFile,
}: SampleDataSelectorProps) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-none border-[#0a1628] text-[#0a1628] hover:bg-[#f5f0e8]"
        onClick={onUseSampleData}
      >
        Use sample data
      </Button>

      {usingSampleData && (
        <div ref={sampleDropdownRef} className="relative max-w-md">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#384865]">
            Sample file
          </label>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-between border border-[#c8c0b3] bg-[#f5f0e8] px-3 text-left text-sm text-[#0a1628] transition-colors hover:border-[#89b4fa]"
            aria-label="Sample file dropdown"
            aria-expanded={sampleDropdownOpen}
            onClick={onToggleDropdown}
          >
            <span>{selectedSampleFile || "Select a test file"}</span>
            <span className="text-xs text-[#384865]">
              {sampleDropdownOpen ? "Close" : "Open"}
            </span>
          </button>

          {sampleDropdownOpen && sampleFiles.length > 0 && (
            <div className="absolute left-0 top-14 z-30 w-full border border-white/10 bg-[#111214] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
              <p className="px-2.5 pb-2 font-mono text-[10px] uppercase tracking-wide text-white/45">
                {sampleFiles.length} file{sampleFiles.length === 1 ? "" : "s"} — scroll if needed
              </p>
              <div
                role="listbox"
                aria-label="Sample files"
                className="max-h-[min(22rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
              >
                {sampleFiles.map((fileName) => (
                  <button
                    key={fileName}
                    type="button"
                    role="option"
                    aria-selected={selectedSampleFile === fileName}
                    className={[
                      "mb-1 block w-full px-2.5 py-2 text-left text-sm transition-colors",
                      selectedSampleFile === fileName
                        ? "bg-white/12 text-white"
                        : "text-white/85 hover:bg-white/7",
                    ].join(" ")}
                    onClick={() => onSelectSampleFile(fileName)}
                  >
                    {fileName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {usingSampleData && sampleListLoading && (
            <p className="mt-2 text-xs text-[#384865]">Loading sample list from API…</p>
          )}
          {usingSampleData && !sampleListLoading && sampleListError && (
            <p className="mt-2 text-xs text-destructive">{sampleListError}</p>
          )}
          {usingSampleData &&
            !sampleListLoading &&
            !sampleListError &&
            sampleFiles.length === 0 && (
              <p className="mt-2 text-xs text-[#384865]">
                No sample files returned from{" "}
                <code className="text-[#0a1628]">GET /uploads/samples</code>.
              </p>
            )}
        </div>
      )}
    </>
  )
}
