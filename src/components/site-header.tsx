import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { ModeToggle } from "./mode-toggle"
import { NotificationsButton } from "./notifications-button"
import { TicketButton } from "./tickets/ticket-button"
import React from "react"

const routeMap: Record<string, string> = {
  chat: "Chat",
  clients: "Clients",
  projects: "Projects",
  phases: "Phases",
  credentials: "Credentials",
  team: "Team",
  "audit-logs": "Audit Logs",
  account: "Account",
  organization: "Organization",
  notifications: "Notifications",
}

function isUUID(str: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function isNumericID(str: string) {
  return /^\d+$/.test(str)
}

export function SiteHeader() {
  const location = useLocation()
  const rawPathnames = location.pathname.split("/").filter((x) => x)
  
  const breadcrumbs = rawPathnames.map((value, index) => {
    const to = `/${rawPathnames.slice(0, index + 1).join("/")}`
    let label = routeMap[value] || value.charAt(0).toUpperCase() + value.slice(1)
    let skip = false

    if (isUUID(value) || (isNumericID(value) && value.length > 5)) {
      label = "Details"
      const parent = rawPathnames[index - 1]
      // Ensure IDs link to overview if next isn't already overview
      if ((parent === "projects" || parent === "clients") && rawPathnames[index + 1] !== "overview") {
        // If there's no next segment, we are already at the ID (which should redirect to overview)
        // or we want it to point to overview.
      }
    }

    if (value === "overview" && index > 0) {
      const prev = rawPathnames[index - 1]
      if (isUUID(prev) || (isNumericID(prev) && prev.length > 5)) {
        skip = true
      }
    }

    return { label, to, skip, isID: isUUID(value) || (isNumericID(value) && value.length > 5) }
  }).filter(b => !b.skip)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex flex-1 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.length === 0 && (
              <BreadcrumbItem>
                <BreadcrumbPage>Projects</BreadcrumbPage>
              </BreadcrumbItem>
            )}
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1
              
              // If it's an ID that isn't the last segment, and it's for projects/clients,
              // make sure it links to the appropriate tab.
              let to = crumb.to
              if (crumb.isID && !last) {
                const parent = rawPathnames[index - 1]
                if (parent === "projects") {
                  if (!to.endsWith("/phases")) {
                    to += "/phases"
                  }
                } else if (parent === "clients") {
                  if (!to.endsWith("/overview")) {
                    to += "/overview"
                  }
                }
              }

              return (
                <React.Fragment key={to + index}>
                  <BreadcrumbItem className={index < breadcrumbs.length - 2 ? "hidden md:inline-flex" : "inline-flex"}>
                    {last ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={to}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && (
                    <BreadcrumbSeparator className={index < breadcrumbs.length - 2 ? "hidden md:block" : "block"} />
                  )}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-4 lg:px-6">
        <TicketButton />
        <ModeToggle />
        <NotificationsButton />
      </div>
    </header>
  )
}
