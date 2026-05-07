export const REVIEW_API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

export type ReviewAction = "accept" | "reject" | "revert"

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
