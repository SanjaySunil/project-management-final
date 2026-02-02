import { Check, CheckCheck, Info, CheckCircle2, AlertCircle, MessageSquare, Trash2, AtSign, ClipboardList } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import type { Notification } from "@/hooks/use-notifications"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, isLoading } = useNotifications()

  return (
    <PageContainer>
      <SEO title="Notifications" description="Stay updated with the latest activity and alerts from your projects." />
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="px-1.5 py-0 text-[10px] h-4">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1.5 text-xs" 
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>

        <div>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full max-w-[400px] grid-cols-3 h-9">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
              <TabsTrigger value="read" className="text-xs">Read</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <NotificationList 
                items={notifications} 
                onMarkAsRead={markAsRead} 
                onDelete={deleteNotification}
                isLoading={isLoading} 
              />
            </TabsContent>
            <TabsContent value="unread" className="mt-4">
              <NotificationList 
                items={notifications.filter(n => !n.is_read)} 
                onMarkAsRead={markAsRead} 
                onDelete={deleteNotification}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="read" className="mt-4">
              <NotificationList 
                items={notifications.filter(n => n.is_read)} 
                onMarkAsRead={markAsRead} 
                onDelete={deleteNotification}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  )
}

function NotificationList({ 
  items, 
  onMarkAsRead,
  onDelete,
  isLoading
}: { 
  items: Notification[],
  onMarkAsRead: (id: string) => void,
  onDelete: (id: string) => void,
  isLoading: boolean
}) {
  const navigate = useNavigate()

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await onMarkAsRead(notification.id)
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

  if (isLoading && items.length === 0) {
    return (
      <div className="divide-y divide-border border rounded-lg bg-card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border border rounded-lg bg-card overflow-hidden">
      {items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No notifications found.
        </div>
      ) : (
        items.map((notification) => {
          const Icon = getIcon(notification.type)
          return (
            <div
              key={notification.id}
              className={cn(
                "flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                !notification.is_read && "bg-primary/5"
              )}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className={cn(
                "mt-0.5 rounded-full p-1.5 shrink-0",
                getTypeColor(notification.type)
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={cn(
                    "text-sm font-semibold leading-none truncate",
                    !notification.is_read ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {notification.title}
                  </h3>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notification.content}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onMarkAsRead(notification.id)}
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(notification.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
