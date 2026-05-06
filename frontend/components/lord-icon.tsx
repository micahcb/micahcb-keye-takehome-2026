"use client"

import { useEffect } from "react"

import { cn } from "@/lib/utils"

let isLordIconRegistered = false

type LordIconTrigger =
  | "hover"
  | "click"
  | "loop"
  | "in"
  | "morph"
  | "boomerang"
  | "sequence"
  | "loop-on-hover"

type LordIconProps = {
  src: string
  trigger?: LordIconTrigger
  target?: string
  size?: number
  colors?: string
  className?: string
}

export function LordIcon({
  src,
  trigger = "hover",
  target,
  size = 24,
  colors,
  className,
}: LordIconProps) {
  useEffect(() => {
    const registerElement = async () => {
      if (isLordIconRegistered) return
      const { defineElement } = await import("@lordicon/element")
      defineElement()
      isLordIconRegistered = true
    }

    void registerElement()
  }, [])

  return (
    <lord-icon
      src={src}
      trigger={trigger}
      target={target}
      colors={colors}
      class={cn("shrink-0 current-color", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    />
  )
}
