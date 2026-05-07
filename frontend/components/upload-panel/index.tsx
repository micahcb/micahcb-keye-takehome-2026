"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

import { CleanButton } from "./clean-button"
import { CleaningProgressOverlay } from "./cleaning-progress-overlay"
import { SampleDataSelector } from "./sample-data-selector"
import { UploadDropzone } from "./upload-dropzone"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

function isParquetFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".parquet")
}

export function UploadPanel() {
  const router = useRouter()
  const sampleDropdownRef = useRef<HTMLDivElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<string>("No file selected")
  const [invalidUploadMessage, setInvalidUploadMessage] = useState("")
  const [uploadStatusMessage, setUploadStatusMessage] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [usingSampleData, setUsingSampleData] = useState(false)
  const [selectedSampleFile, setSelectedSampleFile] = useState("")
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false)
  const [sampleFiles, setSampleFiles] = useState<string[]>([])
  const [sampleListLoading, setSampleListLoading] = useState(true)
  const [sampleListError, setSampleListError] = useState("")
  const [duplicatePromptData, setDuplicatePromptData] = useState<{
    id: string
    rowCount: number
    cellCount: number
    insertedDiffRows: number
    insertedDiffs: number
  } | null>(null)
  const hasUploadedFile = selectedFile !== null && !usingSampleData
  const hasSampleFile = usingSampleData && selectedSampleFile.length > 0
  const canClean = (hasUploadedFile || hasSampleFile) && !isUploading

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!sampleDropdownRef.current) return
      if (!sampleDropdownRef.current.contains(event.target as Node)) {
        setSampleDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown)
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setSampleListLoading(true)
    setSampleListError("")
    ;(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/uploads/samples`, {
          cache: "no-store",
        })
        const data = (await response.json()) as { files?: string[]; detail?: string }
        if (!response.ok) {
          throw new Error(data.detail ?? "Could not load sample files from storage.")
        }
        if (!cancelled) {
          setSampleFiles(Array.isArray(data.files) ? data.files : [])
        }
      } catch (error) {
        if (!cancelled) {
          setSampleListError(
            error instanceof Error ? error.message : "Could not load sample files from storage.",
          )
          setSampleFiles([])
        }
      } finally {
        if (!cancelled) setSampleListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSelectFile = useCallback((file: File | null) => {
    if (!file) return
    if (!isParquetFileName(file.name)) {
      setSelectedFile(null)
      setSelectedLabel("No file selected")
      setInvalidUploadMessage("Only .parquet files can be cleaned.")
      return
    }

    setSelectedFile(file)
    setSelectedLabel(file.name)
    setInvalidUploadMessage("")
    setUploadStatusMessage("")
    setUsingSampleData(false)
    setSelectedSampleFile("")
  }, [])

  const goToReview = useCallback(
    (data: {
      id?: string
      rowCount?: number
      cellCount?: number
      insertedDiffRows?: number
      insertedDiffs?: number
    }) => {
      const searchParams = new URLSearchParams({
        fileId: data.id ?? "",
        rows: String(data.rowCount ?? 0),
        cells: String(data.cellCount ?? 0),
        rowsAdded: String(data.insertedDiffRows ?? 0),
        diffsAdded: String(data.insertedDiffs ?? 0),
      })
      router.push(`/review?${searchParams.toString()}`)
    },
    [router],
  )

  const requestClean = useCallback(
    async (forceReprocess = false) => {
      let response: Response
      if (usingSampleData) {
        response = await fetch(
          `${API_BASE_URL}/uploads/sample${forceReprocess ? "?forceReprocess=true" : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sampleFileName: selectedSampleFile }),
          },
        )
      } else {
        const formData = new FormData()
        formData.append("file", selectedFile as File)
        response = await fetch(
          `${API_BASE_URL}/uploads${forceReprocess ? "?forceReprocess=true" : ""}`,
          {
            method: "POST",
            body: formData,
          },
        )
      }

      const data = (await response.json()) as {
        id?: string
        error?: string
        detail?: string
        path?: string
        duplicate?: boolean
        rowCount?: number
        cellCount?: number
        insertedDiffRows?: number
        insertedDiffs?: number
      }
      if (!response.ok) {
        throw new Error(data.error ?? data.detail ?? "Failed to upload file.")
      }
      return data
    },
    [selectedFile, selectedSampleFile, usingSampleData],
  )

  const onClean = useCallback(async () => {
    if (usingSampleData && !selectedSampleFile) {
      setInvalidUploadMessage("Select a sample file before cleaning.")
      return
    }
    if (!usingSampleData && !selectedFile) return

    setIsUploading(true)
    setInvalidUploadMessage("")
    setUploadStatusMessage("")
    setDuplicatePromptData(null)

    try {
      const data = await requestClean(false)

      setUploadStatusMessage(
        data.duplicate
          ? `File already processed, reusing: ${data.path ?? selectedLabel}`
          : usingSampleData
            ? `Sample processed: ${selectedSampleFile}`
            : `Uploaded to bucket: ${data.path ?? selectedLabel}`,
      )
      if (data.duplicate && data.id) {
        setDuplicatePromptData({
          id: data.id,
          rowCount: data.rowCount ?? 0,
          cellCount: data.cellCount ?? 0,
          insertedDiffRows: data.insertedDiffRows ?? 0,
          insertedDiffs: data.insertedDiffs ?? 0,
        })
        return
      }
      goToReview(data)
    } catch (error) {
      setInvalidUploadMessage(
        error instanceof Error ? error.message : "Failed to upload file.",
      )
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [
    goToReview,
    requestClean,
    selectedFile,
    selectedLabel,
    selectedSampleFile,
    usingSampleData,
  ])

  const onRestartProcess = useCallback(async () => {
    if (!duplicatePromptData || isUploading) return
    setIsUploading(true)
    setInvalidUploadMessage("")
    setUploadStatusMessage("")
    try {
      const data = await requestClean(true)
      setDuplicatePromptData(null)
      goToReview(data)
    } catch (error) {
      setInvalidUploadMessage(
        error instanceof Error ? error.message : "Failed to restart cleaning process.",
      )
    } finally {
      setIsUploading(false)
    }
  }, [duplicatePromptData, goToReview, isUploading, requestClean])

  const onUseSampleData = () => {
    setUsingSampleData(true)
    setSelectedFile(null)
    setInvalidUploadMessage("")
    setUploadStatusMessage("")
    setSelectedLabel("No file selected")
    setSampleDropdownOpen(false)
  }

  const onSelectSampleFile = (fileName: string) => {
    setSelectedSampleFile(fileName)
    setSampleDropdownOpen(false)
  }

  return (
    <section
      className={[
        "relative w-full rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-8",
        isUploading ? "overflow-hidden" : "overflow-visible",
      ].join(" ")}
    >
      <CleaningProgressOverlay active={isUploading} />
      {duplicatePromptData && !isUploading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a1628]/45 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-6 shadow-[0_14px_40px_rgba(10,22,40,0.35)]">
            <h2 className="font-heading text-xl font-semibold text-[#0a1628]">
              This file has already been cleaned
            </h2>
            <p className="mt-2 text-sm text-[#384865]">
              Choose to review existing status or restart processing and regenerate diffs.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-none bg-[#0a1628] text-[#f5f0e8] hover:bg-[#13233b]"
                onClick={() => goToReview(duplicatePromptData)}
              >
                See status
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-none border-[#0a1628] text-[#0a1628] hover:bg-[#0a1628] hover:text-[#f5f0e8]"
                onClick={() => void onRestartProcess()}
              >
                Restart process
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-none text-[#384865]"
                onClick={() => setDuplicatePromptData(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a1628]">Upload source file</h1>
        <p className="mt-2 text-sm text-[#384865]">
          Drag and drop your file, choose one manually, or use our sample data.
        </p>
      </div>

      <UploadDropzone
        onSelectFile={onSelectFile}
        onInvalidFile={() => setInvalidUploadMessage("Only .parquet files can be cleaned.")}
        disabled={isUploading}
      />

      <div className="mb-6 space-y-3">
        <SampleDataSelector
          usingSampleData={usingSampleData}
          sampleDropdownOpen={sampleDropdownOpen}
          selectedSampleFile={selectedSampleFile}
          sampleFiles={sampleFiles}
          sampleListLoading={sampleListLoading}
          sampleListError={sampleListError}
          sampleDropdownRef={sampleDropdownRef}
          onUseSampleData={onUseSampleData}
          onToggleDropdown={() => setSampleDropdownOpen((open) => !open)}
          onSelectSampleFile={onSelectSampleFile}
        />

        <span className="block text-sm text-[#384865]">
          {usingSampleData
            ? selectedSampleFile || "Sample dataset mode enabled"
            : selectedLabel}
        </span>
        {invalidUploadMessage && (
          <span className="block text-sm text-destructive">{invalidUploadMessage}</span>
        )}
        {uploadStatusMessage && (
          <span className="block text-sm text-emerald-700">{uploadStatusMessage}</span>
        )}
      </div>

      <CleanButton disabled={!canClean} loading={isUploading} onClick={onClean} />
    </section>
  )
}
