import { Spinner } from "@/components/ui/spinner"
import { GalleryVerticalEnd } from "lucide-react"

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300">
      <div className="relative flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary text-primary-foreground flex aspect-square size-16 items-center justify-center rounded-2xl shadow-xl ring-4 ring-primary/10">
            <GalleryVerticalEnd className="size-8" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Arehsoft</h1>
            <p className="text-sm text-muted-foreground">Professional Management System</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-10 text-primary" />
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 animate-pulse">
              Initialising
            </span>
            <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full origin-left animate-progress bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
