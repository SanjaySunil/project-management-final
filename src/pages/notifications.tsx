import { Check, CheckCheck, Info, CheckCircle2, AlertCircle, MessageSquare, Trash2, AtSign, ClipboardList, Settings2, BellRing } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { useNotificationSettings } from "@/hooks/use-notification-settings"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import type { Notification } from "@/hooks/use-notifications"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

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
          <div className="flex items-center gap-2">
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
        </div>

        <div>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full max-w-[400px] grid-cols-4 h-9">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
              <TabsTrigger value="read" className="text-xs">Read</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
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
            <TabsContent value="settings" className="mt-4">
              <NotificationSettingsView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  )
}

function NotificationSettingsView() {
  const { settings, updateSettings, isLoading } = useNotificationSettings()
  const { permission, requestPermission } = usePushNotifications()

  const handleToggle = async (key: string, value: boolean) => {
    const success = await updateSettings({ [key]: value })
    if (success) {
      toast.success("Settings updated")
    } else {
      toast.error("Failed to update settings")
    }
  }

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      await requestPermission()
    } else {
      toast.info("To disable push notifications completely, please update your browser settings.")
    }
  }

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Notification Preferences
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how and when you want to be notified about project activity.
          </p>
        </div>
        
        <div className="divide-y">
          {/* Push Notifications */}
          <div className="px-6 py-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 p-2.5 rounded-xl shrink-0">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="push_enabled" className="text-sm font-bold cursor-pointer">
                  Browser Push Notifications
                </Label>
                <p className="text-xs text-muted-foreground leading-tight">
                  Receive notifications even when the app is closed.
                </p>
              </div>
            </div>
            <Switch
              id="push_enabled"
              checked={permission === "granted"}
              onCheckedChange={handlePushToggle}
            />
          </div>

          {/* Direct Messages */}
          <div className="px-6 py-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 p-2.5 rounded-xl shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="dm_enabled" className="text-sm font-bold cursor-pointer">
                  Direct Messages
                </Label>
                <p className="text-xs text-muted-foreground leading-tight">
                  Get notified immediately when you receive a direct message from a team member.
                </p>
              </div>
            </div>
            <Switch
              id="dm_enabled"
              checked={settings?.dm_enabled ?? true}
              onCheckedChange={(checked) => handleToggle("dm_enabled", checked)}
            />
          </div>

          {/* Mentions */}
          <div className="px-6 py-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 p-2.5 rounded-xl shrink-0">
                <AtSign className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="mention_enabled" className="text-sm font-bold cursor-pointer">
                  Mentions & Replies
                </Label>
                <p className="text-xs text-muted-foreground leading-tight">
                  Receive an alert whenever someone mentions you using @username in a channel.
                </p>
              </div>
            </div>
            <Switch
              id="mention_enabled"
              checked={settings?.mention_enabled ?? true}
              onCheckedChange={(checked) => handleToggle("mention_enabled", checked)}
            />
          </div>

          {/* Task Assignments */}
          <div className="px-6 py-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 p-2.5 rounded-xl shrink-0">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="task_enabled" className="text-sm font-bold cursor-pointer">
                  Task Assignments
                </Label>
                <p className="text-xs text-muted-foreground leading-tight">
                  Be notified when you are assigned to a new task or when task status changes.
                </p>
              </div>
            </div>
            <Switch
              id="task_enabled"
              checked={settings?.task_enabled ?? true}
              onCheckedChange={(checked) => handleToggle("task_enabled", checked)}
            />
          </div>
        </div>

        <div className="p-4 bg-muted/30 border-t text-center">
          <p className="text-[11px] text-muted-foreground">
            Changes are saved automatically. Some notifications may still be sent for critical security events.
          </p>
        </div>
      </div>
    </div>
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
