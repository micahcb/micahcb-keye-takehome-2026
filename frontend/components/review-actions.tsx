"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  postReviewFileAction,
  postReviewRowAction,
  type ReviewAction,
} from "@/lib/review-api"

type RowActionButtonsProps = {
  fileId: string
  rowId: string
}

type FileActionButtonsProps = {
  fileId: string
}

function actionButtonLabel(action: ReviewAction, scope: "row" | "file"): string {
  if (scope === "row") {
    if (action === "accept") return "Accept row"
    if (action === "reject") return "Reject row"
    return "Revert row"
  }
  if (action === "accept") return "Accept all"
  if (action === "reject") return "Reject all"
  return "Revert all"
}

export function RowActionButtons({ fileId, rowId }: RowActionButtonsProps) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleAction = async (action: ReviewAction) => {
    if (isBusy) return
    setIsBusy(true)
    try {
      await postReviewRowAction(fileId, rowId, action)
      router.refresh()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(["accept", "reject", "revert"] as ReviewAction[]).map((action) => (
        <Button
          key={action}
          type="button"
          size="sm"
          disabled={isBusy}
          className="rounded-none"
          variant={action === "accept" ? "default" : "outline"}
          onClick={() => void handleAction(action)}
        >
          {actionButtonLabel(action, "row")}
        </Button>
      ))}
    </div>
  )
}

export function FileActionButtons({ fileId }: FileActionButtonsProps) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleAction = async (action: ReviewAction) => {
    if (isBusy) return
    setIsBusy(true)
    try {
      await postReviewFileAction(fileId, action)
      router.refresh()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(["accept", "reject", "revert"] as ReviewAction[]).map((action) => (
        <Button
          key={action}
          type="button"
          size="sm"
          disabled={isBusy}
          className="rounded-none"
          variant={action === "accept" ? "default" : "outline"}
          onClick={() => void handleAction(action)}
        >
          {actionButtonLabel(action, "file")}
        </Button>
      ))}
    </div>
  )
}
