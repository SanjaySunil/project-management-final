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
  useSidebar,
} from "@/components/ui/sidebar"
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
          title: "Roles & Permissions",
          url: "/dashboard/team?tab=roles",
          permission: { action: "read", resource: "roles" },
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
  const { user, checkPermission } = useAuth()
  const { organization } = useOrganization()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  // Close sidebar on mobile when location changes
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [location.pathname, isMobile, setOpenMobile])

  const teams = [
    {
      name: organization?.name || "Acme Inc",
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
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}