import { compressors } from "hyparquet-compressors"
import {
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
  type AsyncBuffer,
} from "hyparquet"
import { getPhysicalColumns } from "hyparquet/src/schema.js"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

type UploadedFileRecord = {
  storage_path: string
  bucket_name: string
  file_name: string
}

export type ParsedParquetRows = {
  columns: string[]
  rowsByIndex: Record<number, Record<string, string | number | null>>
}

const UPLOADS_BUCKET = "uploads"

async function resolveStorageLocation(fileId: string): Promise<UploadedFileRecord | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("storage_path,bucket_name,file_name")
    .eq("id", fileId)
    .maybeSingle<UploadedFileRecord>()

  if (error) {
    throw new Error(error.message)
  }
  return data
}

function normalizeValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" || typeof value === "string") return value
  if (typeof value === "bigint") {
    const asNumber = Number(value)
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) {
    return `[bytes ${value.byteLength}]`
  }
  return String(value)
}

function sanitizeStoragePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "")
  if (trimmed.startsWith("uploads/")) {
    return trimmed.slice("uploads/".length)
  }
  return trimmed
}

function pathVariants(fragment: string): string[] {
  const cleaned = sanitizeStoragePath(fragment)
  if (!cleaned) return []
  const variants = [cleaned]
  if (!cleaned.startsWith("samples/")) {
    variants.push(`samples/${cleaned}`)
  }
  return variants
}

function addAttempts(
  attempts: { bucket: string; path: string }[],
  seen: Set<string>,
  bucket: string,
  paths: string[],
) {
  const b = bucket.trim()
  if (!b) return
  for (const path of paths) {
    const key = `${b}|${path}`
    if (seen.has(key)) continue
    seen.add(key)
    attempts.push({ bucket: b, path })
  }
}

function buildDownloadAttempts(
  storageHint: { path?: string; bucket?: string } | undefined,
  location: UploadedFileRecord,
): { bucket: string; path: string }[] {
  const attempts: { bucket: string; path: string }[] = []
  const seen = new Set<string>()

  const hintBucket = storageHint?.bucket?.trim()
  const hintPath = storageHint?.path?.trim()

  if (hintBucket && hintPath) {
    addAttempts(attempts, seen, hintBucket, pathVariants(hintPath))
  }

  const dbBucket = location.bucket_name?.trim()
  if (dbBucket) {
    addAttempts(attempts, seen, dbBucket, pathVariants(location.storage_path))
    addAttempts(attempts, seen, dbBucket, pathVariants(location.file_name))
  }

  if (hintPath) {
    addAttempts(attempts, seen, UPLOADS_BUCKET, pathVariants(hintPath))
  }

  addAttempts(attempts, seen, UPLOADS_BUCKET, pathVariants(location.storage_path))
  addAttempts(attempts, seen, UPLOADS_BUCKET, pathVariants(location.file_name))

  return attempts
}

function asyncBufferFromArrayBuffer(buffer: ArrayBuffer): AsyncBuffer {
  return {
    byteLength: buffer.byteLength,
    slice(start: number, end?: number) {
      return buffer.slice(start, end ?? buffer.byteLength)
    },
  }
}

export async function getParquetRowsForReview(
  fileId: string,
  rowIndexes: number[],
  storageHint?: { path?: string; bucket?: string },
): Promise<ParsedParquetRows> {
  if (!fileId || rowIndexes.length === 0) {
    return { columns: [], rowsByIndex: {} }
  }

  const storageLocation = await resolveStorageLocation(fileId)

  if (!storageLocation?.storage_path) {
    return { columns: [], rowsByIndex: {} }
  }

  const supabase = getSupabaseAdminClient()
  const attempts = buildDownloadAttempts(storageHint, storageLocation)

  let parquetBuffer: ArrayBuffer | null = null
  let lastErrorMessage = "Could not download parquet file from Supabase storage."

  for (const { bucket, path } of attempts) {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (!error && data) {
      parquetBuffer = await data.arrayBuffer()
      break
    }
    if (error?.message) {
      lastErrorMessage = error.message
    }
  }

  if (!parquetBuffer) {
    throw new Error(lastErrorMessage)
  }

  const file = asyncBufferFromArrayBuffer(parquetBuffer)
  const metadata = await parquetMetadataAsync(file, {})
  const columns = getPhysicalColumns(parquetSchema(metadata))

  const targetIndexes = new Set(rowIndexes)
  const sorted = [...targetIndexes].sort((a, b) => a - b)
  const rowStart = sorted[0] ?? 0
  const rowEnd = sorted[sorted.length - 1]! + 1

  const objectRows = await parquetReadObjects({
    file,
    metadata,
    rowStart,
    rowEnd,
    compressors,
  })

  const rowsByIndex: Record<number, Record<string, string | number | null>> = {}
  for (let i = 0; i < objectRows.length; i++) {
    const globalRowIdx = rowStart + i
    if (!targetIndexes.has(globalRowIdx)) continue
    const raw = objectRows[i] as Record<string, unknown>
    const normalized: Record<string, string | number | null> = {}
    for (const col of columns) {
      normalized[col] = normalizeValue(raw[col])
    }
    rowsByIndex[globalRowIdx] = normalized
  }

  return { columns, rowsByIndex }
}
