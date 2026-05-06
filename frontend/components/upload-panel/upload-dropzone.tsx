"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"

import { LordIcon } from "@/components/lord-icon"

import { LORDICON_UPLOAD } from "./constants"

type UploadDropzoneProps = {
  onSelectFile: (file: File | null) => void | Promise<void>
  onInvalidFile: () => void
  disabled?: boolean
}

export function UploadDropzone({
  onSelectFile,
  onInvalidFile,
  disabled = false,
}: UploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      void onSelectFile(acceptedFiles[0] ?? null)
    },
    [onSelectFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: onInvalidFile,
    disabled,
    multiple: false,
    accept: {
      "application/octet-stream": [".parquet"],
      "application/vnd.apache.parquet": [".parquet"],
    },
  })

  return (
    <div
      {...getRootProps()}
      className={[
        "mb-4 flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-none border-2 border-dashed bg-[#f5f0e8] px-6 py-10 text-center transition-colors duration-300",
        disabled && "cursor-not-allowed opacity-70",
        isDragActive
          ? "border-[#89b4fa] bg-[#eaf1fe]"
          : "border-[#c8c0b3] hover:border-[#89b4fa]",
      ].join(" ")}
    >
      <input {...getInputProps()} />
      <LordIcon
        src={LORDICON_UPLOAD}
        trigger="loop-on-hover"
        size={34}
        className="text-[#0a1628]"
      />
      <span className="text-sm font-medium text-[#0a1628]">
        {disabled ? "Uploading..." : "Drop a file here, or click to browse"}
      </span>
      <span className="text-xs text-[#384865]">Single parquet file upload</span>
    </div>
  )
}
