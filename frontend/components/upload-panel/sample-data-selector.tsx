"use client"

import { Button } from "@/components/ui/button"

type SampleDataSelectorProps = {
  usingSampleData: boolean
  sampleDropdownOpen: boolean
  selectedSampleFile: string
  sampleFiles: string[]
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
            <div className="absolute left-0 top-14 z-20 w-full border border-white/10 bg-[#111214] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
              <div role="listbox" aria-label="Sample files" className="max-h-64 overflow-auto">
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

          {sampleFiles.length === 0 && (
            <p className="mt-2 text-xs text-[#384865]">
              No files found in <code>frontend/test_files</code>.
            </p>
          )}
        </div>
      )}
    </>
  )
}
