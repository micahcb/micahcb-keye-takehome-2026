export const REVIEW_API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

export type ReviewAction = "accept" | "reject" | "revert"

export type ReviewDiffCell = {
  id: string
  column_id: string
  suggested_val: number | null
  current_val: number | null
}

export type ReviewDiffRow = {
  id: string
  source_row_idx: number
  status: string
}

export type ReviewRowBundle = {
  row: ReviewDiffRow
  diffs: ReviewDiffCell[]
}

export async function getReviewFileData(fileId: string, limit = 10_000) {
  const params = new URLSearchParams({
    fileId,
    limit: String(limit),
  })
  const response = await fetch(`${REVIEW_API_BASE_URL}/review/file-data?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  })
  const data = (await response.json()) as {
    rows?: ReviewRowBundle[]
    detail?: string
  }
  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Could not load review data.",
    )
  }
  return data
}

async function postJson(path: string, payload: Record<string, string>) {
  const response = await fetch(`${REVIEW_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as {
    error?: string
    detail?: string | Array<{ msg?: string } | string>
  }
  if (!response.ok) {
    let detailMsg: string | undefined
    if (typeof data.detail === "string") detailMsg = data.detail
    else if (Array.isArray(data.detail) && data.detail[0]) {
      const first = data.detail[0]
      detailMsg = typeof first === "string" ? first : first.msg
    }
    throw new Error(data.error ?? detailMsg ?? "Review action failed.")
  }
  return data
}

export function postReviewRowAction(fileId: string, rowId: string, action: ReviewAction) {
  return postJson("/review/row-action", { fileId, rowId, action })
}

export function postReviewFileAction(fileId: string, action: ReviewAction) {
  return postJson("/review/file-action", { fileId, action })
}
