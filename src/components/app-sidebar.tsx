"use client"

import * as React from "react"
import { useLocation, matchPath } from "react-router-dom"
import {
  GalleryVerticalEnd,
  LayoutDashboard,
  CheckSquare,
  Bell,
  Users,
  Briefcase,
  DollarSign,
  Key,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  Settings2,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useOrganization } from "@/hooks/use-organization"

interface SidebarItem {
  title: string
  url: string
  icon?: any
  permission?: { action: string; resource: string }
  items?: SidebarItem[]
  isActive?: boolean
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16 ml-2 mb-2" />
            {[...Array(i === 1 ? 4 : 3)].map((_, j) => (
              <SidebarMenuSkeleton key={j} showIcon />
            ))}
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Sidebar data structure
const sidebarGroups: Record<string, SidebarItem[]> = {
  platform: [
    {
      title: "Dashboard",
      url: "/dashboard/overview",
      icon: LayoutDashboard,
      permission: { action: "read", resource: "dashboard" },
    },
    {
      title: "My Tasks",
      url: "/dashboard/tasks/assigned",
      icon: CheckSquare,
      permission: { action: "read", resource: "tasks" },
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: Bell,
    },
  ],
  operations: [
    {
      title: "Clients",
      url: "/dashboard/clients",
      icon: Users,
      permission: { action: "read", resource: "clients" },
    },
    {
      title: "Projects",
      url: "/dashboard/projects",
      icon: Briefcase,
      permission: { action: "read", resource: "projects" },
    },
    {
      title: "All Tasks",
      url: "/dashboard/tasks",
      icon: CheckSquare,
      permission: { action: "read", resource: "tasks" },
    },
    {
      title: "Finances",
      url: "/dashboard/finances",
      icon: DollarSign,
      permission: { action: "read", resource: "finances" },
    },
    {
      title: "Credentials",
      url: "/dashboard/credentials",
      icon: Key,
      permission: { action: "read", resource: "credentials" },
    },
  ],
  collaboration: [
    {
      title: "Team Chat",
      url: "/dashboard/chat",
      icon: MessageSquare,
      permission: { action: "read", resource: "chat" },
    },
    {
      title: "Direct Messages",
      url: "/dashboard/chat/dms",
      icon: MessageCircle,
      permission: { action: "read", resource: "chat" },
    },
    {
      title: "Team",
      url: "/dashboard/team",
      icon: ShieldCheck,
      permission: { action: "read", resource: "team" },
    },
  ],
  configuration: [
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Account",
          url: "/dashboard/account",
        },
        {
          title: "Organization",
          url: "/dashboard/organization",
          permission: { action: "read", resource: "organizations" },
        },
        {
          title: "Audit Logs",
          url: "/dashboard/audit-logs",
          permission: { action: "read", resource: "audit_logs" },
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, checkPermission, loading: authLoading } = useAuth()
  const { organization, loading: orgLoading } = useOrganization()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  // Close sidebar on mobile when location changes
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [location.pathname, isMobile, setOpenMobile])

  if (authLoading || orgLoading) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarSkeleton />
      </Sidebar>
    )
  }

  const teams = [
    {
      name: organization?.name || "Organization",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
  ]

  const projectMatch = matchPath({ path: "/dashboard/projects/:projectId/*" }, location.pathname)
  const proposalMatch = matchPath({ path: "/dashboard/projects/:projectId/proposals/:proposalId" }, location.pathname)
  
  const projectId = projectMatch?.params.projectId || proposalMatch?.params.projectId
  const proposalId = proposalMatch?.params.proposalId

  const clientMatch = matchPath({ path: "/dashboard/clients/:clientId/*" }, location.pathname)
  const clientId = clientMatch?.params.clientId

  const userData = {
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User",
    email: user?.email || "",
    avatar: user?.user_metadata?.avatar_url || "/avatars/shadcn.jpg",
  }

  // Helper to filter items by permission
  const filterByPermission = (items: SidebarItem[]): SidebarItem[] => {
    return items.filter(item => {
      if (item.permission) {
        return checkPermission(item.permission.action, item.permission.resource)
      }
      return true
    }).map(item => {
      if (item.items) {
        return {
          ...item,
          items: filterByPermission(item.items)
        }
      }
      return item
    })
  }

  // Transform operations based on context
  const getOperationsNav = () => {
    const items = filterByPermission(sidebarGroups.operations)
    
    return items.map((item: SidebarItem) => {
      // Project contextual sub-menu
      if (item.title === "Projects" && projectId && !proposalId) {
        return {
          ...item,
          isActive: true,
          items: [
            { title: "Proposals", url: `/dashboard/projects/${projectId}/proposals` },
            { title: "Overview", url: `/dashboard/projects/${projectId}/overview` },
            { title: "Project Chat", url: `/dashboard/projects/${projectId}/chat` },
            { title: "← All Projects", url: "/dashboard/projects" }
          ]
        }
      }
      
      // Keep Projects highlighted when inside a project or proposal
      if (item.title === "Projects" && (projectId || location.pathname.startsWith("/dashboard/projects"))) {
        return { ...item, isActive: true }
      }

      // Client contextual sub-menu
      if (item.title === "Clients" && clientId) {
        return {
          ...item,
          isActive: true,
          items: [
            { title: "Overview", url: `/dashboard/clients/${clientId}/overview` },
            { title: "Client Projects", url: `/dashboard/clients/${clientId}/projects` },
            { title: "← All Clients", url: "/dashboard/clients" }
          ]
        }
      }

      if (item.title === "Clients" && location.pathname.startsWith("/dashboard/clients")) {
        return { ...item, isActive: true }
      }

      return item
    })
  }

  // Transform collaboration based on context
  const getCollaborationNav = () => {
    const items = filterByPermission(sidebarGroups.collaboration)
    return items.map((item: SidebarItem) => {
      if (item.title === "Team Chat") {
        // Active if in chat but NOT in DMs
        const isActive = (location.pathname.includes("/chat") && !location.pathname.includes("/chat/dms"))
        return { ...item, isActive }
      }
      if (item.title === "Direct Messages") {
        // Active if in DMs
        const isActive = location.pathname.includes("/chat/dms")
        return { ...item, isActive }
      }
      return item
    })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filterByPermission(sidebarGroups.platform)} label="Platform" />
        <NavMain items={getOperationsNav()} label="Operations" />
        <NavMain items={getCollaborationNav()} label="Collaboration" />
        <NavMain items={filterByPermission(sidebarGroups.configuration)} label="Configuration" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
        <div className="px-4 py-2 text-[10px] text-muted-foreground font-mono opacity-50 group-data-[collapsible=icon]:hidden">
          {__APP_VERSION__}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}