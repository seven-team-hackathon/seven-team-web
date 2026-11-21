import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function StatusPill({ isWarning, children }: { isWarning: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary",
        isWarning && "bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </span>
  )
}
