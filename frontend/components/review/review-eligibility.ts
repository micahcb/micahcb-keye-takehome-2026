import type { ReviewAction } from "@/lib/review-api"

export function canApplyAction(status: string, action: ReviewAction): boolean {
  const normalized = status.toLowerCase()
  if (action === "accept" || action === "reject") return normalized === "suggested"
  if (action === "revert") return normalized === "accepted" || normalized === "denied"
  return false
}

export function isAcceptOrDenyStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s === "accepted" || s === "denied"
}
