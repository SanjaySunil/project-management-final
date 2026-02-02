import { Bell, Info, CheckCircle2, AlertCircle, MessageSquare, AtSign, ClipboardList } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import type { Notification } from "@/hooks/use-notifications"
import { formatDistanceToNow } from "date-fns"

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const navigate = useNavigate()

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'dm': return MessageSquare
      case 'mention': return AtSign
      case 'task': return ClipboardList
      case 'success': return CheckCircle2
      case 'warning': return AlertCircle
      default: return Info
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dm': return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
      case 'mention': return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
      case 'task': return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
      case 'success': return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
      case 'warning': return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
      default: return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
    }
  }

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
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getIcon(notification.type)
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer text-left w-full",
                      !notification.is_read && "bg-muted/30"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={cn(
                      "mt-0.5 rounded-full p-1.5 shrink-0",
                      getTypeColor(notification.type)
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium leading-none truncate",
                        !notification.is_read ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {notification.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
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
