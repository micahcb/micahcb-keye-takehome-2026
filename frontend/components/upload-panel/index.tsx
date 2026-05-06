"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { SAMPLE_FILE_DEFS } from "./constants"
import { CleanButton } from "./clean-button"
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
  const sampleFiles = SAMPLE_FILE_DEFS
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

  const onClean = useCallback(async () => {
    if (usingSampleData && !selectedSampleFile) {
      setInvalidUploadMessage("Select a sample file before cleaning.")
      return
    }
    if (!usingSampleData && !selectedFile) return

    setIsUploading(true)
    setInvalidUploadMessage("")
    setUploadStatusMessage("")

    try {
      let response: Response
      if (usingSampleData) {
        response = await fetch(`${API_BASE_URL}/uploads/sample`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sampleFileName: selectedSampleFile }),
        })
      } else {
        const formData = new FormData()
        formData.append("file", selectedFile as File)
        response = await fetch(`${API_BASE_URL}/uploads`, {
          method: "POST",
          body: formData,
        })
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

      setUploadStatusMessage(
        data.duplicate
          ? `File already processed, reusing: ${data.path ?? selectedLabel}`
          : usingSampleData
            ? `Sample processed: ${selectedSampleFile}`
            : `Uploaded to bucket: ${data.path ?? selectedLabel}`,
      )

      const searchParams = new URLSearchParams({
        fileId: data.id ?? "",
        rows: String(data.rowCount ?? 0),
        cells: String(data.cellCount ?? 0),
        rowsAdded: String(data.insertedDiffRows ?? 0),
        diffsAdded: String(data.insertedDiffs ?? 0),
      })
      router.push(`/review?${searchParams.toString()}`)
    } catch (error) {
      setInvalidUploadMessage(
        error instanceof Error ? error.message : "Failed to upload file.",
      )
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [router, selectedFile, selectedLabel, selectedSampleFile, usingSampleData])

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
    <section className="w-full rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-8">
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
