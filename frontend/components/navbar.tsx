"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

function NavSegments() {
  const pathname = usePathname()

  const segments: { label: string; href: string | null }[] = [
    { label: "Dashboard", href: "/" },
  ]

  if (pathname.startsWith("/review")) {
    segments.push({ label: "Review", href: null })
  } else if (pathname.startsWith("/export")) {
    segments.push({ label: "Export", href: null })
  }

  return (
    <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-[#f5f0e8]/90">
      {segments.map((segment, index) => (
        <span key={`${segment.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && <span className="text-[#89b4fa]/70">|</span>}
          {segment.href ? (
            <Link
              href={segment.href}
              className="transition-colors duration-300 hover:text-[#89b4fa]"
            >
              {segment.label}
            </Link>
          ) : (
            <span className="text-[#f5f0e8]">{segment.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

export function Navbar() {
  return (
    <nav className="section-dark border-b border-[#f5f0e8]/15">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-6">
        <NavSegments />
      </div>
    </nav>
  )
}
