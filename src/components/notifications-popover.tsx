import { Bell, Info, CheckCircle2, AlertCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const notifications = [
  {
    id: 1,
    title: "New Project Assigned",
    description: "You have been assigned to the 'Design Engineering' project.",
    time: "2 hours ago",
    type: "info",
    status: "unread",
    icon: Info,
  },
  {
    id: 2,
    title: "Task Completed",
    description: "The task 'Initial Research' has been marked as complete.",
    time: "5 hours ago",
    type: "success",
    status: "read",
    icon: CheckCircle2,
  },
  {
    id: 3,
    title: "System Update",
    description: "Scheduled maintenance will occur tomorrow at 2:00 AM UTC.",
    time: "1 day ago",
    type: "warning",
    status: "unread",
    icon: AlertCircle,
  },
]

export function NotificationsPopover() {
  const unreadCount = notifications.filter(n => n.status === "unread").length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {unreadCount} New
            </span>
          )}
        </div>
        <ScrollArea className="h-80">
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer text-left",
                  notification.status === "unread" && "bg-muted/30"
                )}
              >
                <div className={cn(
                  "mt-0.5 rounded-full p-1.5",
                  notification.type === "success" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                  notification.type === "warning" ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" :
                  "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                )}>
                  <notification.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className={cn(
                    "text-xs font-medium leading-none",
                    notification.status === "unread" ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {notification.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {notification.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs font-normal" asChild>
            <Link to="/dashboard/notifications">
              Notification Centre
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
