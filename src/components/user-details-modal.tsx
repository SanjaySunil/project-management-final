import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  IconMail, 
  IconUser, 
  IconCalendar, 
  IconShield, 
  IconClipboardList, 
  IconMessage2,
  IconExternalLink,
  IconHammer
} from "@tabler/icons-react"
import { ROLES, type RoleData } from "@/lib/rbac"
import { format } from "date-fns"
import { AssignedTasks } from "@/components/projects/assigned-tasks"
import { DirectMessage } from "@/components/direct-message"
import { Link } from "react-router-dom"

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: string | null
  email: string | null
  updated_at: string | null
}

interface UserDetailsModalProps {
  user: Profile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  availableRoles?: Record<string, RoleData>
  isOnline?: (userId: string) => boolean
}

export function UserDetailsModal({
  user,
  open,
  onOpenChange,
  availableRoles,
  isOnline,
}: UserDetailsModalProps) {
  if (!user) return null

  const allRoles = availableRoles || ROLES
  const roleKey = (user.role || 'employee') as keyof typeof ROLES
  const roleData = allRoles[roleKey] || ROLES.employee

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:max-w-6xl p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] w-[95vw] sm:w-full">
        <DialogHeader className="flex flex-row items-center gap-3 sm:gap-4 text-left p-4 sm:p-6 pb-4 border-b">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 sm:h-16 sm:h-16 border-2 border-primary/10">
              <AvatarImage src={user.avatar_url || ""} />
              <AvatarFallback className="text-lg sm:text-xl">
                {user.full_name?.charAt(0) || <IconUser size={20} />}
              </AvatarFallback>
            </Avatar>
            {isOnline?.(user.id) && (
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 sm:h-4 sm:w-4 rounded-full border-2 sm:border-4 border-background bg-emerald-500" title="Online" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
            <DialogTitle className="text-lg sm:text-xl font-bold truncate">
              {user.full_name || user.username || "Anonymous User"}
            </DialogTitle>
            <Badge 
              variant={roleKey === 'admin' ? 'default' : 'secondary'} 
              className="w-fit capitalize text-[10px] sm:text-xs"
            >
              {roleData.label}
            </Badge>
          </div>
        </DialogHeader>
        
        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 border-b overflow-x-auto no-scrollbar">
            <TabsList variant="line" className="w-full justify-start gap-4 sm:gap-6 min-w-max">
              <TabsTrigger 
                value="info" 
                className="px-0 pb-3 pt-2 font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                <IconUser className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Member Info
              </TabsTrigger>
              <TabsTrigger 
                value="working"
                className="px-0 pb-3 pt-2 font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                <IconHammer className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Working On
              </TabsTrigger>
              <TabsTrigger 
                value="tasks"
                className="px-0 pb-3 pt-2 font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                <IconClipboardList className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Assigned Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="chat"
                className="px-0 pb-3 pt-2 font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                <IconMessage2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Direct Messages
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="info" className="m-0 p-4 sm:p-6 space-y-4">
              <div className="flex items-start sm:items-center gap-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email Address</span>
                  <span className="font-medium break-all">{user.email || "No email provided"}</span>
                </div>
              </div>

              <div className="flex items-start sm:items-center gap-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <IconShield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Role</span>
                  <span className="font-medium">{roleData.label}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2">{roleData.description}</span>
                </div>
              </div>

              {user.updated_at && (
                <div className="flex items-start sm:items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <IconCalendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Updated</span>
                    <span className="font-medium">
                      {format(new Date(user.updated_at), "PPP 'at' p")}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="working" className="m-0 p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Currently Working On</h3>
              </div>
              <AssignedTasks 
                userId={user.id} 
                hideHeader 
                defaultStatusFilter="in progress"
              />
            </TabsContent>

            <TabsContent value="tasks" className="m-0 p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assigned Tasks</h3>
                <Link 
                  to={`/dashboard/tasks/assigned?user=${user.id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                  onClick={() => onOpenChange(false)}
                >
                  <span className="hidden sm:inline">View Full Page</span>
                  <IconExternalLink size={12} />
                </Link>
              </div>
              <AssignedTasks 
                userId={user.id} 
                hideHeader 
              />
            </TabsContent>

            <TabsContent value="chat" className="m-0 h-full min-h-[400px]">
              <DirectMessage 
                recipientId={user.id} 
                recipientName={user.full_name || user.username || "User"} 
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
