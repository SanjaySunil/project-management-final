import { useState } from "react"
import { Check, CheckCheck, Info, CheckCircle2, AlertCircle } from "lucide-react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const initialNotifications = [
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications)

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, status: "read" } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: "read" })))
  }

  const unreadCount = notifications.filter(n => n.status === "unread").length

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
              <NotificationList items={notifications} onMarkAsRead={markAsRead} />
            </TabsContent>
            <TabsContent value="unread" className="mt-4">
              <NotificationList items={notifications.filter(n => n.status === "unread")} onMarkAsRead={markAsRead} />
            </TabsContent>
            <TabsContent value="read" className="mt-4">
              <NotificationList items={notifications.filter(n => n.status === "read")} onMarkAsRead={markAsRead} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  )
}

function NotificationList({ 
  items, 
  onMarkAsRead 
}: { 
  items: typeof initialNotifications,
  onMarkAsRead: (id: number) => void
}) {
  return (
    <div className="divide-y divide-border border rounded-lg bg-card">
      {items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No notifications found.
        </div>
      ) : (
        items.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              "flex items-start gap-3 p-3 transition-colors hover:bg-muted/50",
              notification.status === "unread" && "bg-primary/5"
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
              <div className="flex items-center justify-between gap-2">
                <h3 className={cn(
                  "text-sm font-medium leading-none",
                  notification.status === "unread" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {notification.title}
                </h3>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {notification.time}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {notification.description}
              </p>
            </div>
            {notification.status === "unread" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onMarkAsRead(notification.id)}
                title="Mark as read"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
