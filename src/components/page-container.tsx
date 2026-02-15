import * as React from "react"
import { cn } from "@/lib/utils"

export function PageContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 p-4 lg:p-6 min-h-0 overflow-y-auto", className)}>
      {children}
    </div>
  )
}
