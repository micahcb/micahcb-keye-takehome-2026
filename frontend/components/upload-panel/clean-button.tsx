"use client"

import { LordIcon } from "@/components/lord-icon"
import { Button } from "@/components/ui/button"

import { LORDICON_CLEAN } from "./constants"

type CleanButtonProps = {
  disabled: boolean
  loading?: boolean
  onClick: () => void | Promise<void>
}

export function CleanButton({ disabled, loading = false, onClick }: CleanButtonProps) {
  return (
    <Button
      type="button"
      id="clean-btn"
      disabled={disabled}
      className="rounded-none bg-[#0a1628] px-6 text-[#f5f0e8] hover:bg-[#13233b] disabled:bg-[#384865] disabled:text-[#d8d2c8] disabled:opacity-60"
      onClick={() => void onClick()}
    >
      <span className="mr-2 inline-flex items-center">
        <LordIcon
          src={LORDICON_CLEAN}
          trigger="hover"
          target="#clean-btn"
          size={18}
          className="text-[#f5f0e8]"
        />
      </span>
      {loading ? "Uploading..." : "Clean"}
    </Button>
  )
}
