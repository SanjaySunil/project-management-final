import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SEO } from "./seo"
import { cn } from "@/lib/utils"
import { Outlet } from "react-router-dom"

export function DashboardLayout({ children, className }: { children?: React.ReactNode, className?: string }) {
  return (
    <SidebarProvider>
      <SEO />
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className={cn("flex flex-1 flex-col @container/main", className)}>
          {children || <Outlet />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


