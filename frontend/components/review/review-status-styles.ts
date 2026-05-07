export function statusStyles(status: string, titleBar = false): string {
  const s = status.toLowerCase()
  if (s === "accepted") return "bg-emerald-500/15 text-emerald-900 border-emerald-700/30"
  if (s === "denied") return "bg-destructive/10 text-destructive border-destructive/30"
  return titleBar ? "bg-[#89b4fa]/15 text-[#f5f0e8] border-[#89b4fa]/40" : "bg-[#89b4fa]/15 text-[#0a1628] border-[#89b4fa]/40"
}
